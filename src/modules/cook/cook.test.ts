import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookAnswer } from "@spec/contract";
import { __resetAiDeps, __setAiDeps, type ModelReply } from "@/platform/ai";
import { ApiError } from "@/platform/errors";
import { fakeDb } from "../planning/fake-db";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

let tables: Record<string, Record<string, unknown>[]> = {};
let db = fakeDb(tables);
vi.mock("@/platform/db", () => ({ reader: async () => db, writer: (userId: string) => ({ db, userId }) }));
let plan: "free" | "pro" = "pro";
vi.mock("@/platform/quotas", () => ({ tierAndTimezone: async () => ({ plan, tz: "America/Los_Angeles" }) }));
const fridge = {
  proposeDeductions: vi.fn(),
  applyBatch: vi.fn(async () => ({ createdItemIds: [], fridge: { items: [], expiringSoon: [], cookNow: [] } })),
  view: vi.fn(async () => ({ items: [], expiringSoon: [], cookNow: [] })),
  cookNow: vi.fn(async () => []),
};
vi.mock("@/modules/fridge", () => fridge);
const propose = vi.fn();
vi.mock("@/modules/preferences", () => ({ propose: (...a: unknown[]) => propose(...a) }));
const cook = await import("./index");

let reply: unknown;
const transport = vi.fn(async (): Promise<ModelReply> => ({ parsed: reply, stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } }));

beforeEach(() => {
  plan = "pro";
  tables = {
    recipes: [
      { id: "rcp_fried_rice", owner_id: null, title: "Egg fried rice", base_servings: 2, minutes: 20, equipment: [], tags: [], source_url: null, source_label: "team", image_url: null },
      { id: "rcp_theirs", owner_id: U2, title: "Theirs", base_servings: 2, minutes: 20, equipment: [], tags: [], source_url: null, source_label: "import", image_url: null },
    ],
    recipe_ingredients: [
      { recipe_id: "rcp_fried_rice", ingredient_id: "ing_rice", qty: 150, unit: "g", optional: false, note: null },
      { recipe_id: "rcp_fried_rice", ingredient_id: "ing_egg", qty: 3, unit: "count", optional: false, note: null },
      { recipe_id: "rcp_fried_rice", ingredient_id: "ing_peas", qty: 100, unit: "g", optional: true, note: null },
    ],
    ingredients: [
      { id: "ing_rice", name: "Rice" },
      { id: "ing_egg", name: "Eggs" },
      { id: "ing_peas", name: "Peas" },
    ],
    recipe_chunks: [
      { id: "chk_fried_rice_f1", recipe_id: "rcp_fried_rice", kind: "faq", step_no: null, label: "FAQ: no wok", text: "A wide skillet works.", timer_seconds: null },
      { id: "chk_fried_rice_s1", recipe_id: "rcp_fried_rice", kind: "step", step_no: 1, label: "Step 1", text: "Scramble the eggs.", timer_seconds: null },
    ],
    profiles: [{ user_id: U1, household_size: 2, timezone: "America/Los_Angeles" }],
    category_defaults: [{ category: "prepared", shelf_life_days: { fridge: 3, freezer: 60 } }],
    cook_sessions: [],
    cook_messages: [],
    cook_events: [],
    plans: [{ id: "pln_mine", user_id: U1 }, { id: "pln_theirs", user_id: U2 }],
  };
  db = fakeDb(tables);
  reply = { answer: "Use a wide skillet.", citations: ["chk_fried_rice_f1"], needsClarification: false, notCovered: false, safetyTopic: false };
  transport.mockClear();
  fridge.proposeDeductions.mockReset();
  fridge.applyBatch.mockClear();
  propose.mockReset();
  __setAiDeps({ transport, recordRun: async () => {}, spentTodayUsd: async () => 0, consumeQuota: async () => ({ release: async () => {} }), model: () => "fake" });
});
afterEach(() => __resetAiDeps());

describe("cook.ask (ASK1–ASK5)", () => {
  it("answers from retrieved chunks with citation chips, and keeps the session", async () => {
    const a = await cook.ask(U1, "rcp_fried_rice", { question: "I have no wok" }, "req_1");
    expect(CookAnswer.safeParse(a).success).toBe(true);
    expect(a.citations).toEqual([{ chunkId: "chk_fried_rice_f1", kind: "faq", label: "FAQ: no wok" }]);
    expect(a.sessionId).toMatch(/^cks_/);
    expect(tables.cook_sessions[0]).toMatchObject({ user_id: U1, recipe_id: "rcp_fried_rice" });
    expect(tables.cook_messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    // the question goes to the model as delimited data, with the retrieved chunk ids
    const sent = JSON.stringify(transport.mock.calls[0]);
    expect(sent).toContain("<question>");
    expect(sent).toContain("chk_fried_rice_f1");

    reply = { answer: "Scramble the eggs first.", citations: ["chk_fried_rice_s1"], needsClarification: false, notCovered: false, safetyTopic: false };
    const again = await cook.ask(U1, "rcp_fried_rice", { question: "and step 1?", sessionId: a.sessionId }, "req_2");
    expect(again.citations[0]).toMatchObject({ chunkId: "chk_fried_rice_s1", label: "Step 1" });
    expect(again.sessionId).toBe(a.sessionId);
    expect(JSON.stringify(transport.mock.calls[1])).toContain("user: I have no wok");
  });

  it("repairs once, then turns an uncited answer into the not-covered reply", async () => {
    reply = { answer: "Bake it at 200 C.", citations: ["chk_made_up"], needsClarification: false, notCovered: false, safetyTopic: false };
    await expect(cook.ask(U1, "rcp_fried_rice", { question: "I have no wok" }, "req_1")).rejects.toMatchObject({ status: 502 });
    expect(transport).toHaveBeenCalledTimes(2);

    reply = { answer: "Bake it at 200 C.", citations: [], needsClarification: false, notCovered: false, safetyTopic: false };
    const a = await cook.ask(U1, "rcp_fried_rice", { question: "Can I use an air fryer?" }, "req_2");
    expect(a).toMatchObject({ answer: "This recipe doesn't cover that.", citations: [], notCovered: true });
  });

  it("flags food-safety questions", async () => {
    const a = await cook.ask(U1, "rcp_fried_rice", { question: "Are runny eggs safe here, no wok?" }, "req_1");
    expect(a.safetyTopic).toBe(true);
  });

  it("404s for another user's recipe or session", async () => {
    await expect(cook.ask(U1, "rcp_theirs", { question: "hi" }, "req_1")).rejects.toMatchObject({ status: 404 });
    tables.cook_sessions.push({ id: "cks_theirs", user_id: U2, recipe_id: "rcp_fried_rice" });
    await expect(cook.ask(U1, "rcp_fried_rice", { question: "hi", sessionId: "cks_theirs" }, "req_1")).rejects.toMatchObject({ status: 404 });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("cook.done (CK2)", () => {
  it("proposes deductions, lists unstocked ingredients and leftovers, and writes nothing to the fridge", async () => {
    fridge.proposeDeductions.mockResolvedValue([{ itemId: "itm_egg", ingredientId: "ing_egg", qty: 6, unit: "count", shortBy: null }]);
    const r = await cook.done(U1, "rcp_fried_rice", { servings: 4, planId: "pln_mine" });
    expect(fridge.proposeDeductions).toHaveBeenCalledWith(U1, "rcp_fried_rice", 4);
    expect(r.cookEventId).toMatch(/^cke_/);
    expect(r.missing).toEqual([{ ingredientId: "ing_rice", qty: 300, unit: "g" }]); // optional peas are not missing
    expect(r.leftovers.servings).toBe(2); // 4 cooked for a household of 2
    expect(r.leftovers.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tables.cook_events[0]).toMatchObject({ user_id: U1, status: "proposed", servings: 4, plan_id: "pln_mine" });
    expect(fridge.applyBatch).not.toHaveBeenCalled();
  });
  it("404s for another user's plan", async () => {
    await expect(cook.done(U1, "rcp_fried_rice", { servings: 2, planId: "pln_theirs" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("cook.confirm (CK3)", () => {
  async function proposed() {
    fridge.proposeDeductions.mockResolvedValue([{ itemId: "itm_egg", ingredientId: "ing_egg", qty: 6, unit: "count", shortBy: null }]);
    return (await cook.done(U1, "rcp_fried_rice", { servings: 4 })).cookEventId;
  }

  it("applies edited deductions and leftovers as one batch keyed by the cook event, once", async () => {
    const id = await proposed();
    const r = await cook.confirm(U1, id, { deductions: [{ itemId: "itm_egg", qty: 5 }], leftoverServings: 2, rating: 4 }, "req_1");
    expect(r).toMatchObject({ proposals: [], run: null });
    const [user, events, key] = fridge.applyBatch.mock.calls[0] as unknown as [string, { itemId: string | null; delta: number; newItem?: { kind: string; qty: number } }[], string];
    expect(user).toBe(U1);
    expect(key).toBe(id);
    expect(events[0]).toMatchObject({ itemId: "itm_egg", delta: -5, reason: "cook" });
    expect(events[1]).toMatchObject({ itemId: null, delta: 2, newItem: { kind: "dish", recipeId: "rcp_fried_rice", qty: 2, unit: "count", origin: "cooked" } });
    expect(tables.cook_events[0]).toMatchObject({ status: "confirmed", rating: 4 });

    // a repeat returns the first result and writes nothing
    const again = await cook.confirm(U1, id, { deductions: [{ itemId: "itm_egg", qty: 5 }] }, "req_2");
    expect(again).toEqual(r);
    expect(fridge.applyBatch).toHaveBeenCalledTimes(1);
  });

  it("refuses items that were not proposed", async () => {
    const id = await proposed();
    await expect(cook.confirm(U1, id, { deductions: [{ itemId: "itm_other", qty: 1 }] }, "req_1")).rejects.toMatchObject({ status: 400 });
    expect(fridge.applyBatch).not.toHaveBeenCalled();
  });

  it("sends Pro feedback to preference proposals; Free feedback is only stored", async () => {
    propose.mockResolvedValue([{ id: "prp_1", kind: "soft", category: "texture", value: "saucier", reason: "dry", scopeRecipeId: null }]);
    const id = await proposed();
    const r = await cook.confirm(U1, id, { deductions: [], feedback: "a bit dry" }, "req_1");
    expect(propose).toHaveBeenCalledWith(U1, "a bit dry", { recipeId: "rcp_fried_rice", requestId: "req_1" });
    expect(r.proposals).toHaveLength(1);

    plan = "free";
    const id2 = await proposed();
    const r2 = await cook.confirm(U1, id2, { deductions: [], feedback: "too salty" }, "req_2");
    expect(r2.proposals).toEqual([]);
    expect(propose).toHaveBeenCalledTimes(1);
    expect(tables.cook_events[1]).toMatchObject({ feedback: "too salty" });
  });

  it("still confirms when preferences are not built yet, but other errors propagate", async () => {
    propose.mockRejectedValue(new ApiError(501, "not_implemented", "x"));
    const id = await proposed();
    expect((await cook.confirm(U1, id, { deductions: [], feedback: "dry" }, "req_1")).proposals).toEqual([]);
    propose.mockRejectedValue(new ApiError(502, "model_error", "x"));
    const id2 = await proposed();
    await expect(cook.confirm(U1, id2, { deductions: [], feedback: "dry" }, "req_2")).rejects.toMatchObject({ status: 502 });
  });

  it("404s for another user's cook event", async () => {
    tables.cook_events.push({ id: "cke_theirs", user_id: U2, recipe_id: "rcp_fried_rice", status: "proposed", proposal: { deductions: [], leftovers: { servings: 0, expiresOn: "2026-10-24" }, recipeTitle: "x" }, confirm_result: null });
    await expect(cook.confirm(U1, "cke_theirs", { deductions: [] }, "req_1")).rejects.toMatchObject({ status: 404 });
  });
});
