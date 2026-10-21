// Owner: Receipts. Receipt photo → draft → confirmed fridge items (SPEC §5.4, docs/ROLES.md).
// The draft never changes the fridge; confirm() sends BatchEvent[] to fridge.applyBatch() with
// batch key `rct:<receiptId>`. Lines map to catalog ingredient ids, base units and categories.
import type { z } from "zod";
import type { BatchEvent, FridgeView, ReceiptConfirm, RunInfo } from "@spec/contract";
import { ReceiptExtraction, type ReceiptDraft } from "@spec/contract";
import * as fridge from "@/modules/fridge";
import * as planning from "@/modules/planning";
import { runAi } from "@/platform/ai";
import { reader, writer } from "@/platform/db";
import { localToday } from "@/platform/dates";
import { ApiError, badRequest, conflict, notFound, unprocessable, upstream } from "@/platform/errors";
import { newId } from "@/platform/ids";
import { getImage, parseUpload, putImage, removeImage, sniffImage } from "./image";
import { log } from "@/platform/log";
import { classifyLine, typicalExpiry } from "./lines";
import { planDiff } from "./plan-diff";
import { legibleDate, receiptContent, receiptSystem, validateExtraction, type ImageMediaType } from "./reader";
import { clearImagePath, deleteReceipt, insertReceipt, loadCatalog, markConfirmed, markFailed, ownsPlan, readDraft, readReceipt, saveParsed } from "./store";

export type PlanLabels = { planId: string; ingredientNames: Record<string, string>; recipeTitles: Record<string, string> };

/**
 * The draft as the API returns it: with the plan diff (RCT5) when a plan is linked. A plan the
 * user has since deleted gives no diff rather than an error; any other failure is loud.
 */
async function draftWithDiff(userId: string, receiptId: string): Promise<{ draft: ReceiptDraft; labels: PlanLabels | null }> {
  const { draft, planId } = await readDraft(await reader(), userId, receiptId);
  if (!planId || draft.status === "failed") return { draft, labels: null };
  let plan: Awaited<ReturnType<typeof planning.getPlan>>;
  try {
    plan = await planning.getPlan(userId, planId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { draft, labels: null };
    throw err;
  }
  return {
    draft: { ...draft, planDiff: planDiff(draft.lines, plan.shopping) },
    labels: {
      planId,
      ingredientNames: Object.fromEntries(plan.shopping.items.map((i) => [i.ingredientId, i.name])),
      recipeTitles: Object.fromEntries(plan.meals.map((m) => [m.recipeId, m.title])),
    },
  };
}

/** RCT2–RCT4, RCT7: one receipt_reader run, then code classifies every line. Failures are saved. */
async function read(userId: string, receiptId: string, image: Uint8Array, mediaType: ImageMediaType, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  const db = await reader();
  const w = writer(userId);
  const [catalog, today] = await Promise.all([loadCatalog(db, userId), localToday(userId)]);
  const ids = new Set(catalog.ingredients.keys());

  let output: ReceiptExtraction;
  let run: RunInfo;
  try {
    ({ output, run } = await runAi({
      unit: "receipt_reader",
      userId,
      requestId,
      schema: ReceiptExtraction,
      system: receiptSystem(catalog.list),
      content: receiptContent(image, mediaType),
      validate: (out) => validateExtraction(out, ids),
    }));
  } catch (err) {
    const runId = err instanceof ApiError ? ((err.extra?.run as RunInfo | undefined)?.runId ?? null) : null;
    await markFailed(w, receiptId, err instanceof ApiError ? err.code : "internal", runId);
    throw err;
  }

  if (!output.isReceipt) {
    await markFailed(w, receiptId, "not_a_receipt", run.runId);
    throw unprocessable("not_a_receipt", "This image does not look like a shopping receipt", { run });
  }

  const purchasedOn = legibleDate(output.purchasedOn);
  const dates = { purchasedOn, today };
  const lines = output.lines.map((l) => ({ lineId: newId("rln"), ...classifyLine(l, catalog, dates) }));
  await saveParsed(w, receiptId, { store: output.store, purchasedOn, runId: run.runId }, lines);
  return { receipt: (await draftWithDiff(userId, receiptId)).draft, run };
}

/** Accepts the multipart request (field "image", optional "planId"). */
export async function upload(userId: string, form: FormData, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  const { bytes, mediaType, planId } = await parseUpload(form);
  if (planId && !(await ownsPlan(await reader(), userId, planId))) throw notFound();
  const receiptId = newId("rct");
  const imagePath = await putImage(userId, receiptId, bytes, mediaType);
  await insertReceipt(writer(userId), { id: receiptId, planId, imagePath });
  return read(userId, receiptId, bytes, mediaType, requestId);
}

export async function get(userId: string, receiptId: string): Promise<ReceiptDraft> {
  return (await draftWithDiff(userId, receiptId)).draft;
}

/** For the review page: the draft plus names for the plan diff's ids. */
export async function getForReview(userId: string, receiptId: string): Promise<{ receipt: ReceiptDraft; plan: PlanLabels | null }> {
  const { draft, labels } = await draftWithDiff(userId, receiptId);
  return { receipt: draft, plan: labels };
}

export async function retry(userId: string, receiptId: string, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  const r = await readReceipt(await reader(), userId, receiptId);
  if (r.status !== "failed") throw conflict("not_failed", { receiptStatus: r.status });
  if (!r.image_path) throw conflict("image_expired");
  const bytes = await getImage(userId, r.image_path);
  const mediaType = sniffImage(bytes);
  if (!mediaType) throw new Error("receipts: the stored image is not a JPEG, PNG or WebP");
  return read(userId, receiptId, bytes, mediaType, requestId);
}

/** RCT9: the photo goes once the receipt is confirmed. A failure is loud; a repeat confirm retries it. */
async function dropImage(userId: string, receiptId: string, path: string | null): Promise<void> {
  if (!path) return;
  try {
    await removeImage(userId, path);
  } catch (err) {
    log("receipt_image_delete_failed", { receiptId, error: err instanceof Error ? err.message : String(err) });
    throw upstream("storage_error", "Your items were added, but the receipt photo could not be deleted yet. Try again to finish.");
  }
  await clearImagePath(writer(userId), receiptId);
}

/**
 * RCT6: the user's ticked lines become one fridge batch under `rct:<receiptId>`, so the fridge
 * changes at most once per receipt whatever the client repeats. Same key again: the original
 * result. Another key after a confirm: 409 already_confirmed with the original result.
 */
export async function confirm(userId: string, receiptId: string, input: z.infer<typeof ReceiptConfirm>): Promise<{ addedItemIds: string[]; fridge: FridgeView }> {
  const db = await reader();
  const r = await readReceipt(db, userId, receiptId);

  if (r.status === "confirmed") {
    const addedItemIds = r.confirm_result?.addedItemIds ?? [];
    if (r.confirm_idempotency_key !== input.idempotencyKey) throw conflict("already_confirmed", { addedItemIds, fridge: await fridge.view(userId) });
    await dropImage(userId, receiptId, r.image_path);
    return { addedItemIds, fridge: await fridge.view(userId) };
  }
  if (r.status !== "parsed") throw conflict("not_parsed", { receiptStatus: r.status });

  const [{ draft }, catalog, today] = await Promise.all([readDraft(db, userId, receiptId), loadCatalog(db, userId), localToday(userId)]);
  const drafted = new Map(draft.lines.map((l) => [l.lineId, l]));
  const dates = { purchasedOn: draft.purchasedOn, today };
  const seen = new Set<string>();
  const events: BatchEvent[] = [];

  for (const line of input.lines) {
    const d = drafted.get(line.lineId);
    if (!d || d.decision === "ignored" || seen.has(line.lineId)) throw badRequest("invalid_input", "Each line must be a food line from this receipt, once");
    seen.add(line.lineId);
    if (!line.include) continue;
    // The user may keep the catalog match or drop it (stock as a generic item), never swap it.
    if (line.ingredientId !== null && line.ingredientId !== d.ingredientId) throw badRequest("invalid_input", "A line's ingredient cannot be changed here");
    const ingredient = line.ingredientId ? catalog.ingredients.get(line.ingredientId) : undefined;
    if (line.ingredientId && !ingredient) throw badRequest("invalid_input", "Unknown ingredient");
    if (ingredient && line.unit !== ingredient.baseUnit) throw badRequest("invalid_input", `${ingredient.name} is counted in ${ingredient.baseUnit}`);
    const category = ingredient?.category ?? line.category;
    if (!category) throw badRequest("invalid_input", "Pick a category for items Cooky doesn't know");

    // An untouched date follows the chosen location's typical shelf life; a typed date is the user's.
    const typical = typicalExpiry(line.location, ingredient?.shelfLifeDays ?? {}, catalog.categoryDefaults.get(category), dates);
    const userDate = line.expiresOn !== d.expiresOn;
    events.push({
      itemId: null,
      delta: line.qty,
      reason: "purchase",
      newItem: {
        kind: ingredient ? "ingredient" : "generic",
        ingredientId: ingredient?.id ?? null,
        recipeId: null,
        name: line.name.trim() || d.name,
        category,
        qty: line.qty,
        unit: line.unit,
        location: line.location,
        expiresOn: userDate ? line.expiresOn : typical.expiresOn,
        expirySource: userDate ? "user" : typical.source,
        origin: "receipt",
      },
    });
  }

  const result = events.length ? await fridge.applyBatch(userId, events, `rct:${receiptId}`) : { createdItemIds: [], fridge: await fridge.view(userId) };
  await markConfirmed(writer(userId), receiptId, input.idempotencyKey, result.createdItemIds);
  await dropImage(userId, receiptId, r.image_path);
  return { addedItemIds: result.createdItemIds, fridge: result.fridge };
}

/** DELETE /api/receipts/{id}: the photo, the receipt and its lines. Fridge items already added stay. */
export async function remove(userId: string, receiptId: string): Promise<void> {
  const r = await readReceipt(await reader(), userId, receiptId);
  if (r.image_path) await removeImage(userId, r.image_path);
  await deleteReceipt(writer(userId), receiptId);
}
