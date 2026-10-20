// Owner: Receipts & Fridge. Receipt photo → draft → confirmed fridge items (SPEC §5.4).
// The draft never changes the fridge; confirm() writes through fridge.applyBatch().
import type { z } from "zod";
import type { FridgeView, ReceiptConfirm, ReceiptDraft, RunInfo } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

/** Accepts the multipart request (field "image", optional "planId"). */
export async function upload(userId: string, form: FormData, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  void userId;
  void form;
  void requestId;
  throw notImplemented("receipts.upload");
}

export async function get(userId: string, receiptId: string): Promise<ReceiptDraft> {
  void userId;
  void receiptId;
  throw notImplemented("receipts.get");
}

export async function retry(userId: string, receiptId: string, requestId: string): Promise<{ receipt: ReceiptDraft; run: RunInfo }> {
  void userId;
  void receiptId;
  void requestId;
  throw notImplemented("receipts.retry");
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
