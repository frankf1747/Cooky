import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptConfirmResponse, ReceiptDraft, type BatchEvent, type ReceiptConfirm } from "@spec/contract";
import { __resetAiDeps, __setAiDeps, type ModelReply } from "@/platform/ai";
import { aiFixtures } from "@/platform/ai-fixtures";
import { fakeDb } from "../planning/fake-db";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

let tables: Record<string, Record<string, unknown>[]> = {};
let db = fakeDb(tables);
vi.mock("@/platform/db", () => ({
  reader: async () => db,
  writer: (userId: string) => ({ db, userId }),
}));
const images = new Map<string, Uint8Array>();
vi.mock("./image", async (orig) => ({
  ...(await orig<typeof import("./image")>()),
  removeImage: async (_userId: string, path: string) => {
    if (failRemove) throw new Error("storage down");
    images.delete(path);
  },
}));
let failRemove = false;
/** A receipt saved before photos stopped being stored: its photo is still in storage. */
function legacyPhoto(receiptId: string) {
  const path = `${U1}/${receiptId}`;
  images.set(path, JPEG);
  tables.receipts.find((r) => r.id === receiptId)!.image_path = path;
}
// Stand-in for fridge.applyBatch with the database function's rule: one batch key writes once,
// and a repeat returns the first result.
const batches = new Map<string, { events: BatchEvent[]; ids: string[] }>();
const applyBatch = vi.fn(async (userId: string, events: BatchEvent[], batchKey: string) => {
  const key = `${userId}|${batchKey}`;
  if (!batches.has(key)) batches.set(key, { events, ids: events.map((_, i) => `itm_${batchKey.replace(/\W/g, "")}${i}`) });
  return { createdItemIds: batches.get(key)!.ids, fridge: { items: [], expiringSoon: [], cookNow: [] } };
});
vi.mock("@/modules/fridge", () => ({
  applyBatch: (...a: Parameters<typeof applyBatch>) => applyBatch(...a),
  view: async () => ({ items: [], expiringSoon: [], cookNow: [] }),
}));
// Stand-in for planning.getPlan: the one plan U1 owns, with a shopping list; anything else is 404.
let planBroken = false;
vi.mock("@/modules/planning", async () => {
  const { notFound } = await import("@/platform/errors");
  const item = (ingredientId: string, buyQty: number, forRecipeIds: string[]) => ({
    ingredientId, name: ingredientId, needQty: buyQty, unit: "g", haveQty: 0, buyQty, packages: buyQty ? 1 : 0,
    packageSize: 100, packageCents: 100, costCents: 100, leftoverQty: 0, forRecipeIds,
  });
  return {
    getPlan: async (userId: string, planId: string) => {
      if (planBroken) throw new Error("planning: database down");
      if (userId !== U1 || planId !== "pln_mine" || !tables.plans.some((p) => p.id === "pln_mine")) throw notFound();
      return {
        planId, meals: [],
        shopping: { totalCents: 0, unpricedIngredientIds: [], items: [item("ing_chicken_breast", 600, ["rcp_chicken"]), item("ing_garlic", 3, ["rcp_chicken", "rcp_rice"])] },
      };
    },
  };
});
const receipts = await import("./index");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

function form(bytes: Uint8Array, extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("image", new Blob([bytes as BlobPart], { type: "image/jpeg" }), "receipt.jpg");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

function seed() {
  tables = {
    ingredients: [
      { id: "ing_chicken_breast", owner_id: null, name: "Chicken breast", aliases: ["ORG BNLS CHKN BRST"], category: "meat", base_unit: "g", shelf_life_days: { fridge: 2, freezer: 270 }, plausible_max_qty: 3000 },
      { id: "ing_spinach", owner_id: null, name: "Baby spinach", aliases: ["BABY SPINACH"], category: "produce", base_unit: "g", shelf_life_days: { fridge: 5 }, plausible_max_qty: 1000 },
      { id: "ing_secret", owner_id: U2, name: "U2's custom", aliases: [], category: "other", base_unit: "count", shelf_life_days: {}, plausible_max_qty: null },
    ],
    products: [{ id: "prd_spinach_170g", ingredient_id: "ing_spinach", package_size: 170, unit: "g" }],
    category_defaults: [
      { category: "snacks", shelf_life_days: { pantry: 60 } },
      { category: "meat", shelf_life_days: { fridge: 2, freezer: 270 } },
      { category: "produce", shelf_life_days: { fridge: 5, freezer: 240 } },
      { category: "pantry", shelf_life_days: { pantry: 365 } },
    ],
    profiles: [{ user_id: U1, timezone: "America/Los_Angeles" }],
    plans: [
      { id: "pln_mine", user_id: U1 },
      { id: "pln_theirs", user_id: U2 },
    ],
    receipts: [],
    receipt_lines: [],
  };
  db = fakeDb(tables);
  images.clear();
  batches.clear();
  applyBatch.mockClear();
  failRemove = false;
  planBroken = false;
}

const fixture = async (): Promise<ModelReply> => ({ parsed: aiFixtures.receipt_reader({ system: "", text: "" }), stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } });
let transport = vi.fn<(req: unknown) => Promise<ModelReply>>(fixture);
const reply = (parsed: unknown, stopReason = "end_turn"): ModelReply => ({ parsed, stopReason, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } });

beforeEach(() => {
  seed();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T05:00:00Z")); // still 2026-10-20 in Los Angeles
  transport = vi.fn<(req: unknown) => Promise<ModelReply>>(fixture);
  __setAiDeps({
    transport: (req) => transport(req as never),
    recordRun: async () => {},
    spentTodayUsd: async () => 0,
    consumeQuota: async () => ({ release: async () => {} }),
    model: () => "fake",
  });
});
afterEach(() => {
  vi.useRealTimers();
  __resetAiDeps();
});

describe("receipts.upload (RCT1, RCT2, RCT4)", () => {
  it("reads the photo in memory, stores nothing, and returns a parsed draft classified by code", async () => {
    const { receipt, run } = await receipts.upload(U1, form(JPEG), "req_1");
    expect(ReceiptDraft.parse(receipt)).toEqual(receipt);
    expect(run.terminated).toBe("done");
    expect(receipt).toMatchObject({ status: "parsed", store: "Trader Joe's", purchasedOn: null, planDiff: null });
    expect(images.size).toBe(0);

    expect(receipt.lines.map((l) => [l.name, l.decision, l.flagReason, l.qty, l.unit])).toEqual([
      ["Chicken breast", "auto", null, 598.74, "g"],
      ["Baby spinach", "auto", null, 170.1, "g"],
      ["Pita chips", "generic", null, 1, "count"],
      ["Herb blend?", "flagged", "low_confidence", 1, "count"],
      ["Bag fee", "ignored", null, null, null],
    ]);
    // No legible purchase date: expiry counts from the user's local today (2026-10-20), not UTC.
    expect(receipt.lines[0]).toMatchObject({ location: "fridge", expiresOn: "2026-10-22" });
    expect(receipt.lines.every((l) => /^rln_/.test(l.lineId))).toBe(true);

    expect(tables.receipts).toEqual([expect.objectContaining({ id: receipt.receiptId, user_id: U1, status: "parsed", image_path: null, run_id: run.runId })]);
    expect(tables.receipt_lines).toHaveLength(5);
    expect(tables.receipt_lines.every((r) => r.user_id === U1 && r.receipt_id === receipt.receiptId)).toBe(true);
  });

  it("sends the catalog in the cached system prompt and the image as a delimited data block", async () => {
    await receipts.upload(U1, form(JPEG), "req_1");
    const req = transport.mock.calls[0][0] as { system: string; messages: { content: { type: string; text?: string }[] }[] };
    expect(req.system).toContain("ing_chicken_breast | Chicken breast");
    expect(req.system).not.toContain("ing_secret"); // another user's custom ingredient
    const blocks = req.messages[0].content;
    expect(blocks.map((b) => b.type)).toEqual(["text", "image", "text"]);
    expect(blocks[0].text).toContain("<receipt_image>");
  });

  it("an id outside the catalog fails nothing: no repair, that one line is flagged, the rest are kept (receipts exception)", async () => {
    const out = aiFixtures.receipt_reader({ system: "", text: "" }) as { lines: { ingredientId: string | null }[] };
    out.lines[0].ingredientId = "ing_secret"; // another user's custom ingredient
    out.lines[1].ingredientId = "ing_made_up";
    transport.mockResolvedValueOnce(reply(out));
    const { receipt, run } = await receipts.upload(U1, form(JPEG), "req_1");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(run.terminated).toBe("done");
    expect(receipt.status).toBe("parsed");
    expect(receipt.lines.map((l) => [l.name, l.decision, l.flagReason, l.ingredientId])).toEqual([
      ["Chicken breast", "flagged", "unknown_ingredient", null],
      ["Baby spinach", "flagged", "unknown_ingredient", null],
      ["Pita chips", "generic", null, null],
      ["Herb blend?", "flagged", "low_confidence", null],
      ["Bag fee", "ignored", null, null],
    ]);
    // G1: nothing outside this user's catalog is ever stored.
    expect(tables.receipt_lines.every((r) => r.ingredient_id === null || ["ing_chicken_breast", "ing_spinach"].includes(r.ingredient_id as string))).toBe(true);
  });

  it("an id on a non-food line is dropped; the line stays ignored", async () => {
    const out = aiFixtures.receipt_reader({ system: "", text: "" }) as { lines: { ingredientId: string | null }[] };
    out.lines[4].ingredientId = "ing_chicken_breast"; // "BAG FEE"
    transport.mockResolvedValueOnce(reply(out));
    const { receipt } = await receipts.upload(U1, form(JPEG), "req_1");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(receipt.lines[4]).toMatchObject({ name: "Bag fee", decision: "ignored", ingredientId: null });
  });

  it("links a plan the user owns; another user's plan is 404 and nothing is stored", async () => {
    await receipts.upload(U1, form(JPEG, { planId: "pln_mine" }), "req_1");
    expect(tables.receipts[0].plan_id).toBe("pln_mine");

    seed();
    await expect(receipts.upload(U1, form(JPEG, { planId: "pln_theirs" }), "req_2")).rejects.toMatchObject({ status: 404 });
    expect(tables.receipts).toHaveLength(0);
    expect(images.size).toBe(0);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing image, a non-image and an oversized file before any AI call", async () => {
    await expect(receipts.upload(U1, new FormData(), "r")).rejects.toMatchObject({ status: 400 });
    await expect(receipts.upload(U1, form(PDF), "r")).rejects.toMatchObject({ status: 400 });
    const huge = new Uint8Array(8 * 1024 * 1024 + 1);
    huge.set(JPEG);
    await expect(receipts.upload(U1, form(huge), "r")).rejects.toMatchObject({ status: 413 });
    expect(transport).not.toHaveBeenCalled();
    expect(tables.receipts).toHaveLength(0);
  });
});

describe("receipts.upload failures (RCT7)", () => {
  it("not a receipt → 422 not_a_receipt, saved failed with that reason", async () => {
    transport.mockResolvedValueOnce(reply({ isReceipt: false, store: null, purchasedOn: null, lines: [] }));
    await expect(receipts.upload(U1, form(JPEG), "r")).rejects.toMatchObject({ status: 422, code: "not_a_receipt" });
    expect(tables.receipts[0]).toMatchObject({ status: "failed", failure_reason: "not_a_receipt" });
    expect(tables.receipt_lines).toHaveLength(0);
  });

  it("model error → 502, saved failed with the reason; no photo is kept", async () => {
    transport.mockRejectedValueOnce(new Error("overloaded"));
    await expect(receipts.upload(U1, form(JPEG), "r")).rejects.toMatchObject({ status: 502, code: "model_error" });
    expect(tables.receipts[0]).toMatchObject({ status: "failed", failure_reason: "model_error", image_path: null });
    expect(images.size).toBe(0);
  });

  it("output that stays invalid after repairs → 502, never a partial draft", async () => {
    transport.mockResolvedValue(reply({ isReceipt: true, store: null, purchasedOn: null, lines: "nope" }));
    await expect(receipts.upload(U1, form(JPEG), "r")).rejects.toMatchObject({ status: 502 });
    expect(tables.receipts[0]).toMatchObject({ status: "failed" });
    expect(tables.receipt_lines).toHaveLength(0);
  });

  it("a coupon and a refund do not fail the receipt: no repair, lines saved inside the contract", async () => {
    const out = aiFixtures.receipt_reader({ system: "", text: "" }) as { lines: Record<string, unknown>[] };
    out.lines.push(
      { raw: "SC COUPON -1.00", kind: "discount", ingredientId: null, category: null, name: "Coupon", qty: null, unit: null, packageCount: null, priceCents: -100, confidence: "high" },
      { raw: "RFND CHKN BRST -1.32 LB", kind: "food", ingredientId: "ing_chicken_breast", category: "meat", name: "Chicken breast", qty: -1.32, unit: "lb", packageCount: 1, priceCents: -799, confidence: "high" },
    );
    transport.mockResolvedValueOnce(reply(out));
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(receipt.lines.slice(-2).map((l) => [l.decision, l.flagReason, l.qty, l.priceCents])).toEqual([
      ["ignored", null, null, null],
      ["flagged", "implausible_quantity", null, null],
    ]);
    expect(tables.receipt_lines.every((r) => (r.price_cents === null || (r.price_cents as number) >= 0) && (r.qty === null || (r.qty as number) >= 0))).toBe(true);
  });

  it("an illegible purchase date from the model is dropped, not stored", async () => {
    const out = aiFixtures.receipt_reader({ system: "", text: "" }) as Record<string, unknown>;
    transport.mockResolvedValueOnce(reply({ ...out, purchasedOn: "2026-13-45" }));
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    expect(receipt.purchasedOn).toBeNull();
  });
});

describe("receipts.get", () => {
  it("returns the user's draft with lines in printed order; another user's receipt is 404", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    tables.receipt_lines.reverse();
    const again = await receipts.get(U1, receipt.receiptId);
    expect(again).toEqual(receipt);
    await expect(receipts.get(U2, receipt.receiptId)).rejects.toMatchObject({ status: 404 });
    await expect(receipts.get(U1, "rct_missing")).rejects.toMatchObject({ status: 404 });
  });
});

describe("receipts.retry (RCT7)", () => {
  it("no photo is kept, so a failed receipt asks for a new scan (409 rescan_needed)", async () => {
    transport.mockRejectedValueOnce(new Error("timeout"));
    await expect(receipts.upload(U1, form(JPEG), "r")).rejects.toMatchObject({ status: 502 });
    const id = tables.receipts[0].id as string;
    await expect(receipts.retry(U1, id, "r2")).rejects.toMatchObject({ status: 409, code: "rescan_needed" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("a parsed receipt is 409 not_failed; another user's is 404", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    await expect(receipts.retry(U1, receipt.receiptId, "r2")).rejects.toMatchObject({ status: 409, code: "not_failed", extra: { receiptStatus: "parsed" } });
    await expect(receipts.retry(U2, receipt.receiptId, "r2")).rejects.toMatchObject({ status: 404 });
  });
});


describe("today comes from the user's timezone (localToday, #12)", () => {
  it("a user with no profile yet gets dates from the default timezone, not UTC", async () => {
    // 05:00 UTC on 2026-10-21 is still 2026-10-20 in the default zone (America/Los_Angeles).
    const { receipt } = await receipts.upload(U2, form(JPEG), "r");
    expect(receipt.lines[0]).toMatchObject({ name: "Chicken breast", expiresOn: "2026-10-22" });
  });
});

/** The body the review screen sends: every non-ignored line the draft ticked, as drafted. */
function confirmInput(receipt: ReceiptDraft, key = "key-confirm-1"): ReceiptConfirm {
  return {
    idempotencyKey: key,
    lines: receipt.lines
      .filter((l) => l.decision === "auto" || l.decision === "generic")
      .map((l) => ({ lineId: l.lineId, include: true, ingredientId: l.ingredientId, name: l.name, category: l.category, qty: l.qty!, unit: l.unit!, location: l.location!, expiresOn: l.expiresOn })),
  };
}
const byName = (r: ReceiptDraft, name: string) => r.lines.find((l) => l.name === name)!;

describe("receipts.confirm (RCT6, RCT9)", () => {
  it("writes the ticked lines as one fridge batch keyed rct:<receiptId>, then deletes the photo", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    const res = await receipts.confirm(U1, receipt.receiptId, confirmInput(receipt));

    expect(ReceiptConfirmResponse.parse(res)).toEqual(res);
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [userId, events, batchKey] = applyBatch.mock.calls[0];
    expect([userId, batchKey]).toEqual([U1, `rct:${receipt.receiptId}`]);
    expect(events).toEqual([
      { itemId: null, delta: 598.74, reason: "purchase", newItem: { kind: "ingredient", ingredientId: "ing_chicken_breast", recipeId: null, name: "Chicken breast", category: "meat", qty: 598.74, unit: "g", location: "fridge", expiresOn: "2026-10-22", expirySource: "table", origin: "receipt" } },
      { itemId: null, delta: 170.1, reason: "purchase", newItem: { kind: "ingredient", ingredientId: "ing_spinach", recipeId: null, name: "Baby spinach", category: "produce", qty: 170.1, unit: "g", location: "fridge", expiresOn: "2026-10-25", expirySource: "table", origin: "receipt" } },
      { itemId: null, delta: 1, reason: "purchase", newItem: { kind: "generic", ingredientId: null, recipeId: null, name: "Pita chips", category: "snacks", qty: 1, unit: "count", location: "pantry", expiresOn: "2026-12-19", expirySource: "category", origin: "receipt" } },
    ]);
    expect(res.addedItemIds).toHaveLength(3);

    expect(tables.receipts[0]).toMatchObject({ status: "confirmed", confirm_idempotency_key: "key-confirm-1", confirm_result: { addedItemIds: res.addedItemIds }, image_path: null });
    expect(images.size).toBe(0);
    expect((await receipts.get(U1, receipt.receiptId)).status).toBe("confirmed");
  });

  it("an unticked flagged line is not added; a flagged line the user fixed is added as they set it", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    const body = confirmInput(receipt);
    expect(body.lines.map((l) => l.name)).not.toContain("Herb blend?");
    await receipts.confirm(U1, receipt.receiptId, body);
    expect(applyBatch.mock.calls[0][1]).toHaveLength(3);

    seed();
    const again = (await receipts.upload(U1, form(JPEG), "r")).receipt;
    const herb = byName(again, "Herb blend?");
    const fixed = confirmInput(again, "key-confirm-2");
    fixed.lines.push({ lineId: herb.lineId, include: true, ingredientId: null, name: "Herb blend", category: "pantry", qty: 1, unit: "count", location: "pantry", expiresOn: null });
    await receipts.confirm(U1, again.receiptId, fixed);
    expect(applyBatch.mock.calls[0][1][3].newItem).toMatchObject({ kind: "generic", name: "Herb blend", category: "pantry", location: "pantry", expiresOn: "2027-10-20", expirySource: "category" });
  });

  it("include: false lines are skipped", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    const body = confirmInput(receipt);
    body.lines[1].include = false;
    const res = await receipts.confirm(U1, receipt.receiptId, body);
    expect(applyBatch.mock.calls[0][1].map((e) => e.newItem?.name)).toEqual(["Chicken breast", "Pita chips"]);
    expect(res.addedItemIds).toHaveLength(2);
  });

  it("moving a line without touching its date recomputes the typical date; a date the user typed is kept", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    const body = confirmInput(receipt);
    body.lines[0].location = "freezer"; // chicken: freezer shelf life 270 days
    body.lines[1].expiresOn = "2026-10-23"; // spinach: the user's own date
    await receipts.confirm(U1, receipt.receiptId, body);
    const [chicken, spinach] = applyBatch.mock.calls[0][1].map((e) => e.newItem);
    expect(chicken).toMatchObject({ location: "freezer", expiresOn: "2027-07-17", expirySource: "table" });
    expect(spinach).toMatchObject({ location: "fridge", expiresOn: "2026-10-23", expirySource: "user" });
  });

  it("the same key again returns the original result and adds nothing (a double tap)", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    const first = await receipts.confirm(U1, receipt.receiptId, confirmInput(receipt));
    const second = await receipts.confirm(U1, receipt.receiptId, confirmInput(receipt));
    expect(second.addedItemIds).toEqual(first.addedItemIds);
    expect(batches.size).toBe(1);
  });

  it("a different key on a confirmed receipt → 409 already_confirmed with the original result", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    const first = await receipts.confirm(U1, receipt.receiptId, confirmInput(receipt));
    await expect(receipts.confirm(U1, receipt.receiptId, confirmInput(receipt, "key-other-99"))).rejects.toMatchObject({
      status: 409, code: "already_confirmed", extra: { addedItemIds: first.addedItemIds },
    });
  });

  it("rejects lines that are not this receipt's food lines, changed ids, wrong units and missing categories; nothing is written", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    const bag = byName(receipt, "Bag fee");
    const cases: ((b: ReceiptConfirm) => void)[] = [
      (b) => (b.lines[0].lineId = "rln_not_on_this_receipt"),
      (b) => b.lines.push({ lineId: bag.lineId, include: true, ingredientId: null, name: "Bag fee", category: "other", qty: 1, unit: "count", location: "pantry", expiresOn: null }),
      (b) => b.lines.push({ ...b.lines[0] }),
      (b) => (b.lines[0].ingredientId = "ing_spinach"),
      (b) => (b.lines[0].unit = "count"),
      (b) => (b.lines[2].category = null),
    ];
    for (const mutate of cases) {
      const body = confirmInput(receipt);
      mutate(body);
      await expect(receipts.confirm(U1, receipt.receiptId, body)).rejects.toMatchObject({ status: 400 });
    }
    expect(applyBatch).not.toHaveBeenCalled();
    expect(tables.receipts[0].status).toBe("parsed");
  });

  it("another user's receipt is 404; a failed receipt cannot be confirmed (409)", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    await expect(receipts.confirm(U2, receipt.receiptId, confirmInput(receipt))).rejects.toMatchObject({ status: 404 });
    tables.receipts[0].status = "failed";
    await expect(receipts.confirm(U1, receipt.receiptId, confirmInput(receipt))).rejects.toMatchObject({ status: 409, code: "not_parsed" });
    expect(applyBatch).not.toHaveBeenCalled();
  });

  it("a photo stored before this change is deleted on confirm", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    legacyPhoto(receipt.receiptId);
    await receipts.confirm(U1, receipt.receiptId, confirmInput(receipt));
    expect(images.size).toBe(0);
    expect(tables.receipts[0].image_path).toBeNull();
  });

  it("if deleting an old photo fails, the error is loud and a retry with the same key finishes the job", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    legacyPhoto(receipt.receiptId);
    failRemove = true;
    await expect(receipts.confirm(U1, receipt.receiptId, confirmInput(receipt))).rejects.toMatchObject({ status: 502, code: "storage_error" });
    expect(tables.receipts[0]).toMatchObject({ status: "confirmed" });
    expect(images.size).toBe(1);

    failRemove = false;
    const res = await receipts.confirm(U1, receipt.receiptId, confirmInput(receipt));
    expect(res.addedItemIds).toHaveLength(3);
    expect(batches.size).toBe(1);
    expect(images.size).toBe(0);
    expect(tables.receipts[0].image_path).toBeNull();
  });
});

describe("receipts.remove (RCT9)", () => {
  it("deletes the receipt, its lines and any old photo; another user's receipt is 404", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    legacyPhoto(receipt.receiptId);
    await expect(receipts.remove(U2, receipt.receiptId)).rejects.toMatchObject({ status: 404 });
    await receipts.remove(U1, receipt.receiptId);
    expect(images.size).toBe(0);
    expect(tables.receipts).toHaveLength(0);
    expect(tables.receipt_lines).toHaveLength(0);
    await expect(receipts.get(U1, receipt.receiptId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("plan diff on the draft (RCT5)", () => {
  it("a receipt linked to the user's plan shows what was not bought and what was not planned", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG, { planId: "pln_mine" }), "r");
    // The fixture bought chicken and spinach; the plan wanted chicken and garlic.
    expect(receipt.planDiff).toEqual({ missing: [{ ingredientId: "ing_garlic", forRecipeIds: ["rcp_chicken", "rcp_rice"] }], extra: ["ing_spinach"] });
    expect((await receipts.get(U1, receipt.receiptId)).planDiff).toEqual(receipt.planDiff);
  });

  it("no linked plan → planDiff null", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    expect(receipt.planDiff).toBeNull();
  });

  it("a plan deleted after the scan → planDiff null, not an error", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG, { planId: "pln_mine" }), "r");
    tables.plans = tables.plans.filter((p) => p.id !== "pln_mine");
    expect((await receipts.get(U1, receipt.receiptId)).planDiff).toBeNull();
  });

  it("any other planning failure is loud", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG, { planId: "pln_mine" }), "r");
    planBroken = true;
    await expect(receipts.get(U1, receipt.receiptId)).rejects.toThrow("database down");
  });
});
