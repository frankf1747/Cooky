// Owner: Receipts & Fridge. The virtual fridge and its ledger (SPEC §5.5). ledger.ts (create it)
// is the only code that changes quantities, via the apply_inventory_batch() database function.
import type { z } from "zod";
import type { BatchEvent, CookNowEntry, Deduction, FridgeCheck, FridgeItem, FridgeItemCreate, FridgeItemPatch, FridgeView } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function view(userId: string): Promise<FridgeView> {
  void userId;
  throw notImplemented("fridge.view");
}

export async function addItem(userId: string, input: z.infer<typeof FridgeItemCreate>): Promise<{ itemId: string }> {
  void userId;
  void input;
  throw notImplemented("fridge.addItem");
}

export async function updateItem(userId: string, itemId: string, input: z.infer<typeof FridgeItemPatch>): Promise<FridgeItem> {
  void userId;
  void itemId;
  void input;
  throw notImplemented("fridge.updateItem");
}

/** Join: apply one confirmed batch atomically; a repeated batchKey writes nothing (SPEC FRG2). */
export async function applyBatch(userId: string, events: BatchEvent[], batchKey: string): Promise<{ createdItemIds: string[]; fridge: FridgeView }> {
  void userId;
  void events;
  void batchKey;
  throw notImplemented("fridge.applyBatch");
}

/** Join used by cook.done: what to deduct for a recipe, oldest expiry first. Writes nothing. */
export async function proposeDeductions(userId: string, recipeId: string, servings: number): Promise<Deduction[]> {
  void userId;
  void recipeId;
  void servings;
  throw notImplemented("fridge.proposeDeductions");
}

export async function expiringSoon(userId: string): Promise<FridgeItem[]> {
  void userId;
  throw notImplemented("fridge.expiringSoon");
}

/** Join: recipes ranked by what is in stock, soonest-expiring first. No model call (cheap path). */
export async function cookNow(userId: string): Promise<CookNowEntry[]> {
  void userId;
  throw notImplemented("fridge.cookNow");
}

// ---- v2
export async function check(userId: string, input: z.infer<typeof FridgeCheck>): Promise<FridgeView> {
  void userId;
  void input;
  throw notImplemented("fridge.check (v2)");
}
export async function stats(userId: string): Promise<{ tossedCents30d: number; tossedItems30d: number; cookedMeals30d: number }> {
  void userId;
  throw notImplemented("fridge.stats (v2)");
}
