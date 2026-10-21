import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptDraft } from "@spec/contract";
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
  putImage: async (userId: string, receiptId: string, bytes: Uint8Array) => (images.set(`${userId}/${receiptId}`, bytes), `${userId}/${receiptId}`),
  getImage: async (_userId: string, path: string) => {
    const b = images.get(path);
    if (!b) throw new Error("no image");
    return b;
  },
  removeImage: async (_userId: string, path: string) => void images.delete(path),
}));
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
  it("stores the image privately, reads it, and returns a parsed draft classified by code", async () => {
    const { receipt, run } = await receipts.upload(U1, form(JPEG), "req_1");
    expect(ReceiptDraft.parse(receipt)).toEqual(receipt);
    expect(run.terminated).toBe("done");
    expect(receipt).toMatchObject({ status: "parsed", store: "Trader Joe's", purchasedOn: null, planDiff: null });
    expect(images.has(`${U1}/${receipt.receiptId}`)).toBe(true);

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

    expect(tables.receipts).toEqual([expect.objectContaining({ id: receipt.receiptId, user_id: U1, status: "parsed", image_path: `${U1}/${receipt.receiptId}`, run_id: run.runId })]);
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

  it("an ingredient id outside the catalog is sent back for one repair, then accepted", async () => {
    const good = aiFixtures.receipt_reader({ system: "", text: "" }) as { lines: { ingredientId: string | null }[] };
    const bad = structuredClone(good);
    bad.lines[0].ingredientId = "ing_secret";
    transport.mockResolvedValueOnce(reply(bad)).mockResolvedValueOnce(reply(good));
    const { receipt, run } = await receipts.upload(U1, form(JPEG), "req_1");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(run.terminated).toBe("done");
    expect(receipt.lines[0].ingredientId).toBe("ing_chicken_breast");
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

  it("model error → 502, saved failed with the reason, image kept for retry", async () => {
    transport.mockRejectedValueOnce(new Error("overloaded"));
    await expect(receipts.upload(U1, form(JPEG), "r")).rejects.toMatchObject({ status: 502, code: "model_error" });
    expect(tables.receipts[0]).toMatchObject({ status: "failed", failure_reason: "model_error" });
    expect(images.size).toBe(1);
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
  it("re-reads a failed receipt from its stored image", async () => {
    transport.mockRejectedValueOnce(new Error("timeout"));
    await expect(receipts.upload(U1, form(JPEG), "r")).rejects.toMatchObject({ status: 502 });
    const id = tables.receipts[0].id as string;

    const { receipt } = await receipts.retry(U1, id, "r2");
    expect(receipt).toMatchObject({ receiptId: id, status: "parsed" });
    expect(receipt.lines).toHaveLength(5);
    expect(tables.receipts[0]).toMatchObject({ status: "parsed", failure_reason: null });
  });

  it("only failed receipts can be retried; another user's is 404", async () => {
    const { receipt } = await receipts.upload(U1, form(JPEG), "r");
    await expect(receipts.retry(U1, receipt.receiptId, "r2")).rejects.toMatchObject({ status: 409, code: "not_failed", extra: { receiptStatus: "parsed" } });
    await expect(receipts.retry(U2, receipt.receiptId, "r2")).rejects.toMatchObject({ status: 404 });
  });
});
