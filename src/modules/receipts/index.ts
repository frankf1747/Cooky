// Owner: Receipts. Receipt photo → draft → confirmed fridge items (SPEC §5.4, docs/ROLES.md).
// The draft never changes the fridge; confirm() sends BatchEvent[] to fridge.applyBatch() with
// batch key `rct:<receiptId>`. Lines map to catalog ingredient ids, base units and categories.
import type { z } from "zod";
import type { BatchEvent, Category, FridgeView, ReceiptConfirm, ReceiptDraft, RunInfo } from "@spec/contract";
import * as fridge from "@/modules/fridge";
import * as planning from "@/modules/planning";
import { reader, writer } from "@/platform/db";
import { localToday } from "@/platform/dates";
import { ApiError, badRequest, conflict, notFound, unprocessable, upstream } from "@/platform/errors";
import { newId } from "@/platform/ids";
import { log } from "@/platform/log";
import { extractReceipt, type Extracted } from "./extract";
import { parseUpload, removeImage } from "./image";
import { typicalExpiry, type CatalogIngredient } from "./lines";
import { planDiff } from "./plan-diff";
import type { ImageMediaType } from "./reader";
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

/** RCT2–RCT4, RCT7: read the image (extract.ts), save the classified draft. Failures are saved. */
async function read(userId: string, receiptId: string, image: Uint8Array, mediaType: ImageMediaType, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  const db = await reader();
  const w = writer(userId);
  const [catalog, today] = await Promise.all([loadCatalog(db, userId), localToday(userId)]);

  let out: Extracted;
  try {
    out = await extractReceipt({ userId, requestId, image, mediaType, catalog, today });
  } catch (err) {
    const runId = err instanceof ApiError ? ((err.extra?.run as RunInfo | undefined)?.runId ?? null) : null;
    await markFailed(w, receiptId, err instanceof ApiError ? err.code : "internal", runId);
    throw err;
  }

  if (!out.isReceipt) {
    await markFailed(w, receiptId, "not_a_receipt", out.run.runId);
    throw unprocessable("not_a_receipt", "This image does not look like a shopping receipt", { run: out.run });
  }

  await saveParsed(w, receiptId, { store: out.store, purchasedOn: out.purchasedOn, runId: out.run.runId }, out.lines);
  return { receipt: (await draftWithDiff(userId, receiptId)).draft, run: out.run };
}

/** Accepts the multipart request (field "image", optional "planId"). */
export async function upload(userId: string, form: FormData, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  const { bytes, mediaType, planId } = await parseUpload(form);
  if (planId && !(await ownsPlan(await reader(), userId, planId))) throw notFound();
  // The photo is read from memory and never stored (RCT9).
  const receiptId = newId("rct");
  await insertReceipt(writer(userId), { id: receiptId, planId });
  return read(userId, receiptId, bytes, mediaType, requestId);
}

export async function get(userId: string, receiptId: string): Promise<ReceiptDraft> {
  return (await draftWithDiff(userId, receiptId)).draft;
}

export type ReviewShelf = {
  baseDate: string;
  ingredients: Record<string, { baseUnit: CatalogIngredient["baseUnit"]; shelfLifeDays: CatalogIngredient["shelfLifeDays"] }>;
  categories: Partial<Record<Category, CatalogIngredient["shelfLifeDays"]>>;
};

/**
 * For the review page: the draft, names for the plan diff's ids, and the units and shelf lives
 * of this receipt's catalog items, so the page shows the same typical dates confirm will store.
 */
export async function getForReview(userId: string, receiptId: string): Promise<{ receipt: ReceiptDraft; plan: PlanLabels | null; shelf: ReviewShelf }> {
  const [{ draft, labels }, catalog, today] = await Promise.all([
    draftWithDiff(userId, receiptId),
    loadCatalog(await reader(), userId),
    localToday(userId),
  ]);
  const ids = new Set(draft.lines.flatMap((l) => (l.ingredientId ? [l.ingredientId] : [])));
  const shelf: ReviewShelf = {
    baseDate: draft.purchasedOn ?? today,
    ingredients: Object.fromEntries([...ids].flatMap((id) => {
      const i = catalog.ingredients.get(id);
      return i ? [[id, { baseUnit: i.baseUnit, shelfLifeDays: i.shelfLifeDays }]] : [];
    })),
    categories: Object.fromEntries(catalog.categoryDefaults),
  };
  return { receipt: draft, plan: labels, shelf };
}

/**
 * RCT7: photos are never stored, so a failed read cannot be re-read on the server. The scan page
 * retries by sending the same photo again (it is still on the device); this route says so.
 */
export async function retry(userId: string, receiptId: string, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  void requestId;
  const r = await readReceipt(await reader(), userId, receiptId);
  if (r.status !== "failed") throw conflict("not_failed", { receiptStatus: r.status });
  throw conflict("rescan_needed", { message: "Cooky doesn't keep receipt photos. Scan the receipt again." });
}

/**
 * RCT9: clears a photo stored before photos stopped being kept (new receipts have none). A failure
 * is loud; a repeat confirm retries it.
 */
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
    // The review page recomputes an untouched date when the location or category changes, so a
    // date equal to the typical one for the chosen location is typical too.
    const userDate = line.expiresOn !== d.expiresOn && line.expiresOn !== typical.expiresOn;
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

/** DELETE /api/receipts/{id}: the receipt, its lines and any old photo. Fridge items already added stay. */
export async function remove(userId: string, receiptId: string): Promise<void> {
  const r = await readReceipt(await reader(), userId, receiptId);
  if (r.image_path) await removeImage(userId, r.image_path);
  await deleteReceipt(writer(userId), receiptId);
}
