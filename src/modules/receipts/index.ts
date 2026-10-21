// Owner: Receipts. Receipt photo → draft → confirmed fridge items (SPEC §5.4, docs/ROLES.md).
// The draft never changes the fridge; confirm() sends BatchEvent[] to fridge.applyBatch() with
// batch key `rct:<receiptId>`. Lines map to catalog ingredient ids, base units and categories.
import type { z } from "zod";
import type { FridgeView, ReceiptConfirm, RunInfo } from "@spec/contract";
import { ReceiptExtraction, type ReceiptDraft } from "@spec/contract";
import { runAi } from "@/platform/ai";
import { reader, writer } from "@/platform/db";
import { ApiError, conflict, notFound, notImplemented, unprocessable } from "@/platform/errors";
import { newId } from "@/platform/ids";
import { getImage, parseUpload, putImage, sniffImage } from "./image";
import { classifyLine } from "./lines";
import { legibleDate, receiptContent, receiptSystem, validateExtraction, type ImageMediaType } from "./reader";
import { insertReceipt, loadCatalog, markFailed, ownsPlan, readDraft, readReceipt, saveParsed, userTimezone } from "./store";

const localToday = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

/** RCT2–RCT4, RCT7: one receipt_reader run, then code classifies every line. Failures are saved. */
async function read(userId: string, receiptId: string, image: Uint8Array, mediaType: ImageMediaType, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  const db = await reader();
  const w = writer(userId);
  const [catalog, tz] = await Promise.all([loadCatalog(db, userId), userTimezone(db, userId)]);
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
  const dates = { purchasedOn, today: localToday(tz) };
  const lines = output.lines.map((l) => ({ lineId: newId("rln"), ...classifyLine(l, catalog, dates) }));
  await saveParsed(w, receiptId, { store: output.store, purchasedOn, runId: run.runId }, lines);
  return { receipt: await readDraft(db, userId, receiptId), run };
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
  return readDraft(await reader(), userId, receiptId);
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

export async function confirm(userId: string, receiptId: string, input: z.infer<typeof ReceiptConfirm>): Promise<{ addedItemIds: string[]; fridge: FridgeView }> {
  void userId;
  void receiptId;
  void input;
  throw notImplemented("receipts.confirm");
}

export async function remove(userId: string, receiptId: string): Promise<void> {
  void userId;
  void receiptId;
  throw notImplemented("receipts.remove");
}
