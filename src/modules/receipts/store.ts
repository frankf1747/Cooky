// Owner: Receipts. Reads go through the user's session (RLS) and filter by user; writes use
// writer(userId) with user_id from the session. The draft never touches fridge tables (RCT6).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, ReceiptDraft, ReceiptLine } from "@spec/contract";
import { notFound } from "@/platform/errors";
import type { CatalogIngredient, LineCatalog } from "./lines";

type ReceiptRow = {
  id: string;
  status: ReceiptDraft["status"];
  store: string | null;
  purchased_on: string | null;
  image_path: string | null;
  confirm_idempotency_key: string | null;
  confirm_result: { addedItemIds: string[] } | null;
};
type LineRow = {
  id: string;
  position: number;
  raw: string;
  kind: ReceiptLine["kind"];
  ingredient_id: string | null;
  category: Category | null;
  name: string;
  qty: number | string | null;
  unit: ReceiptLine["unit"];
  price_cents: number | null;
  confidence: ReceiptLine["confidence"];
  decision: ReceiptLine["decision"];
  flag_reason: ReceiptLine["flagReason"];
  location: ReceiptLine["location"];
  expires_on: string | null;
};

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`receipts: ${what} failed: ${error?.message ?? "no row"}`);
}

/** The catalog plus this user's custom ingredients, never another user's. */
export async function loadCatalog(db: SupabaseClient, userId: string): Promise<LineCatalog & { list: (CatalogIngredient & { aliases: string[] })[] }> {
  const [ing, prd, cat] = await Promise.all([
    db.from("ingredients").select("id, owner_id, name, aliases, category, base_unit, shelf_life_days, plausible_max_qty").or(`owner_id.is.null,owner_id.eq.${userId}`),
    db.from("products").select("ingredient_id, package_size, unit"),
    db.from("category_defaults").select("category, shelf_life_days"),
  ]);
  if (ing.error) fail("loading ingredients", ing.error);
  if (prd.error) fail("loading products", prd.error);
  if (cat.error) fail("loading category defaults", cat.error);
  const list = (ing.data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    aliases: (r.aliases as string[] | null) ?? [],
    category: r.category as Category,
    baseUnit: r.base_unit as CatalogIngredient["baseUnit"],
    shelfLifeDays: (r.shelf_life_days as CatalogIngredient["shelfLifeDays"] | null) ?? {},
    plausibleMaxQty: r.plausible_max_qty === null ? null : Number(r.plausible_max_qty),
  }));
  return {
    list,
    ingredients: new Map(list.map((i) => [i.id, i])),
    products: (prd.data ?? []).map((r) => ({ ingredientId: r.ingredient_id as string, packageSize: Number(r.package_size), unit: r.unit as CatalogIngredient["baseUnit"] })),
    categoryDefaults: new Map((cat.data ?? []).map((r) => [r.category as Category, (r.shelf_life_days as CatalogIngredient["shelfLifeDays"] | null) ?? {}])),
  };
}

export async function ownsPlan(db: SupabaseClient, userId: string, planId: string): Promise<boolean> {
  const { data, error } = await db.from("plans").select("id").eq("id", planId).eq("user_id", userId).maybeSingle();
  if (error) fail("loading the plan", error);
  return data !== null;
}

export async function readReceipt(db: SupabaseClient, userId: string, receiptId: string): Promise<ReceiptRow> {
  const { data, error } = await db.from("receipts").select("id, status, store, purchased_on, image_path, confirm_idempotency_key, confirm_result").eq("id", receiptId).eq("user_id", userId).maybeSingle();
  if (error) fail("loading the receipt", error);
  if (!data) throw notFound();
  return data as ReceiptRow;
}

export async function insertReceipt(w: { db: SupabaseClient; userId: string }, row: { id: string; planId: string | null; imagePath: string }): Promise<void> {
  const { error } = await w.db.from("receipts").insert({ id: row.id, user_id: w.userId, status: "parsing", plan_id: row.planId, image_path: row.imagePath });
  if (error) fail("saving the receipt", error);
}

export async function markFailed(w: { db: SupabaseClient; userId: string }, receiptId: string, reason: string, runId: string | null): Promise<void> {
  const { error } = await w.db.from("receipts").update({ status: "failed", failure_reason: reason, run_id: runId }).eq("id", receiptId).eq("user_id", w.userId);
  if (error) fail("marking the receipt failed", error);
}

/** Replaces any earlier lines (a retry) and marks the receipt parsed. */
export async function saveParsed(
  w: { db: SupabaseClient; userId: string },
  receiptId: string,
  head: { store: string | null; purchasedOn: string | null; runId: string },
  lines: ReceiptLine[],
): Promise<void> {
  const del = await w.db.from("receipt_lines").delete().eq("receipt_id", receiptId).eq("user_id", w.userId);
  if (del.error) fail("clearing old lines", del.error);
  if (lines.length) {
    const ins = await w.db.from("receipt_lines").insert(lines.map((l, position) => ({
      id: l.lineId, receipt_id: receiptId, user_id: w.userId, position, raw: l.raw, kind: l.kind,
      ingredient_id: l.ingredientId, category: l.category, name: l.name, qty: l.qty, unit: l.unit,
      price_cents: l.priceCents, confidence: l.confidence, decision: l.decision, flag_reason: l.flagReason,
      location: l.location, expires_on: l.expiresOn,
    })));
    if (ins.error) fail("saving the lines", ins.error);
  }
  const upd = await w.db.from("receipts")
    .update({ status: "parsed", store: head.store, purchased_on: head.purchasedOn, run_id: head.runId, failure_reason: null })
    .eq("id", receiptId).eq("user_id", w.userId);
  if (upd.error) fail("marking the receipt parsed", upd.error);
}

export async function readDraft(db: SupabaseClient, userId: string, receiptId: string): Promise<ReceiptDraft> {
  const r = await readReceipt(db, userId, receiptId);
  const { data, error } = await db.from("receipt_lines")
    .select("id, position, raw, kind, ingredient_id, category, name, qty, unit, price_cents, confidence, decision, flag_reason, location, expires_on")
    .eq("receipt_id", receiptId).eq("user_id", userId);
  if (error) fail("loading the lines", error);
  const rows = ((data ?? []) as LineRow[]).sort((a, b) => a.position - b.position);
  return {
    receiptId: r.id,
    status: r.status,
    store: r.store,
    purchasedOn: r.purchased_on ? String(r.purchased_on).slice(0, 10) : null,
    lines: rows.map((l) => ({
      lineId: l.id, raw: l.raw, kind: l.kind, ingredientId: l.ingredient_id, category: l.category, name: l.name,
      qty: l.qty === null ? null : Number(l.qty), unit: l.unit, priceCents: l.price_cents, confidence: l.confidence,
      decision: l.decision, flagReason: l.flag_reason, location: l.location,
      expiresOn: l.expires_on ? String(l.expires_on).slice(0, 10) : null,
    })),
    planDiff: null,
  };
}

/** Records the confirm (RCT6) so a repeat can return it; the image path stays until it is deleted. */
export async function markConfirmed(w: { db: SupabaseClient; userId: string }, receiptId: string, key: string, addedItemIds: string[]): Promise<void> {
  const { error } = await w.db.from("receipts")
    .update({ status: "confirmed", confirm_idempotency_key: key, confirm_result: { addedItemIds } })
    .eq("id", receiptId).eq("user_id", w.userId);
  if (error) fail("marking the receipt confirmed", error);
}

export async function clearImagePath(w: { db: SupabaseClient; userId: string }, receiptId: string): Promise<void> {
  const { error } = await w.db.from("receipts").update({ image_path: null }).eq("id", receiptId).eq("user_id", w.userId);
  if (error) fail("clearing the image path", error);
}

export async function deleteReceipt(w: { db: SupabaseClient; userId: string }, receiptId: string): Promise<void> {
  const lines = await w.db.from("receipt_lines").delete().eq("receipt_id", receiptId).eq("user_id", w.userId);
  if (lines.error) fail("deleting the lines", lines.error);
  const r = await w.db.from("receipts").delete().eq("id", receiptId).eq("user_id", w.userId);
  if (r.error) fail("deleting the receipt", r.error);
}
