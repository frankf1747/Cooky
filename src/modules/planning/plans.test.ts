import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanDraft, PlanSummary } from "@spec/contract";
import { __resetAiDeps, __setAiDeps, type ModelReply } from "@/platform/ai";
import { aiFixtures } from "@/platform/ai-fixtures";
import { fakeDb } from "./fake-db";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

let tables: Record<string, Record<string, unknown>[]> = {};
let db = fakeDb(tables);
vi.mock("@/platform/db", () => ({
  reader: async () => db,
  writer: (userId: string) => ({ db, userId }),
}));
const planning = await import("./index");

function seed() {
  tables = {
    recipes: [
      { id: "rcp_chicken", owner_id: null, title: "Chicken", base_servings: 2, minutes: 30, equipment: [] },
      { id: "rcp_omelette", owner_id: null, title: "Omelette", base_servings: 2, minutes: 10, equipment: [] },
      { id: "rcp_rice", owner_id: null, title: "Fried rice", base_servings: 2, minutes: 20, equipment: [] },
    ],
    recipe_ingredients: [
      { recipe_id: "rcp_chicken", ingredient_id: "ing_chicken", qty: 400, unit: "g", optional: false },
      { recipe_id: "rcp_omelette", ingredient_id: "ing_egg", qty: 3, unit: "count", optional: false },
      { recipe_id: "rcp_rice", ingredient_id: "ing_rice", qty: 300, unit: "g", optional: false },
      { recipe_id: "rcp_rice", ingredient_id: "ing_egg", qty: 2, unit: "count", optional: false },
    ],
    ingredients: [
      { id: "ing_chicken", name: "Chicken", allergen_tags: [] },
      { id: "ing_egg", name: "Egg", allergen_tags: ["egg"] },
      { id: "ing_rice", name: "Rice", allergen_tags: [] },
    ],
    products: [
      { id: "prd_chicken", ingredient_id: "ing_chicken", package_size: 500, unit: "g", price_cents: 800, price_date: "2026-10-20" },
      { id: "prd_egg", ingredient_id: "ing_egg", package_size: 12, unit: "count", price_cents: 400, price_date: "2026-10-19" },
      { id: "prd_rice", ingredient_id: "ing_rice", package_size: 1000, unit: "g", price_cents: 300, price_date: "2026-10-20" },
    ],
    fridge_items: [
      { id: "itm_chicken", user_id: U1, kind: "ingredient", status: "active", ingredient_id: "ing_chicken", qty: 400, unit: "g", expires_on: "2026-10-21" },
      { id: "itm_theirs", user_id: U2, kind: "ingredient", status: "active", ingredient_id: "ing_rice", qty: 900, unit: "g", expires_on: null },
    ],
    profiles: [{ user_id: U1, excluded_ingredient_ids: [], allergen_tags: [], equipment: [], staple_ingredient_ids: [], timezone: "America/Los_Angeles" }],
    preferences: [{ id: "prf_spicy", user_id: U1, kind: "soft", active: true, category: "flavor", value: "spicy", scope_recipe_id: null }],
    plans: [],
    plan_versions: [],
  };
  db = fakeDb(tables, { unique: { plans: [["user_id", "idempotency_key"]] }, defaults: { plans: () => ({ created_at: new Date().toISOString() }) } });
}

const fixture = async (req: { messages: { content: unknown }[] }): Promise<ModelReply> => {
  const text = req.messages.map((m) => (Array.isArray(m.content) ? m.content.map((b: { text?: string }) => b.text ?? "").join("\n") : String(m.content))).join("\n");
  return { parsed: aiFixtures.planner({ system: "", text }), stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } };
};
let transport = vi.fn(fixture);
const quotaUsed = vi.fn();
const quotaReleased = vi.fn();

beforeEach(() => {
  seed();
  transport = vi.fn(fixture);
  quotaUsed.mockClear();
  quotaReleased.mockClear();
  __setAiDeps({
    transport: (req) => transport(req as never),
    recordRun: async () => {},
    spentTodayUsd: async () => 0,
    consumeQuota: async () => (quotaUsed(), { release: async () => quotaReleased() }),
    model: () => "fake",
  });
});
afterEach(() => __resetAiDeps());

const body = (over: Record<string, unknown> = {}) => ({ servings: 2, budgetCents: 4000, maxMinutes: 30, meals: 2, idempotencyKey: "key-00000001", ...over });

describe("createPlan", () => {
  it("returns a contract-valid draft from the cheapest set, priced in code, and stores it", async () => {
    const { plan, run } = await planning.createPlan(U1, body(), "req_1");
    expect(PlanDraft.safeParse(plan).success).toBe(true);
    expect(run.terminated).toBe("done");
    expect(plan.status).toBe("draft");
    expect(plan.version).toBe(1);
    // chicken is in the fridge, so chicken + omelette costs only the eggs
    expect(plan.meals.map((m) => m.recipeId)).toEqual(["rcp_chicken", "rcp_omelette"]);
    expect(plan.totalCents).toBe(400);
    expect(plan.shopping.totalCents).toBe(400);
    expect(plan.priceAsOf).toBe("2026-10-20");
    expect(plan.meals[0].usesFridgeItemIds).toEqual(["itm_chicken"]);
    expect(plan.meals[1].usesFridgeItemIds).toEqual([]);
    expect(plan.assumptions[0]).toMatch(/taxes are not included/);
    expect(tables.plans).toHaveLength(1);
    expect(tables.plans[0]).toMatchObject({ user_id: U1, status: "draft", idempotency_key: "key-00000001" });
    expect(tables.plan_versions[0]).toMatchObject({ user_id: U1, plan_id: plan.planId, version: 1, total_cents: 400 });
    // generating a plan never changes the fridge (PLN6)
    expect(tables.fridge_items[0]).toMatchObject({ qty: 400, status: "active" });
  });

  it("sends the sets, the expiring item and the soft preference to the planner", async () => {
    await planning.createPlan(U1, body({ wishes: "something quick" }), "req_1");
    const text = JSON.stringify(transport.mock.calls[0][0]);
    expect(text).toContain("set_1: rcp_chicken, rcp_omelette");
    expect(text).toContain("prf_spicy");
    expect(text).toContain("something quick");
  });

  it("is idempotent: same key returns the same plan without another model call", async () => {
    const first = await planning.createPlan(U1, body(), "req_1");
    const again = await planning.createPlan(U1, body(), "req_2");
    expect(again.plan).toEqual(first.plan);
    expect(again.run.costUsd).toBe(0);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(tables.plans).toHaveLength(1);
  });

  it("infeasible: 422 with the cheapest total and what to relax, and no model call or quota use", async () => {
    await expect(planning.createPlan(U1, body({ budgetCents: 100 }), "req_1")).rejects.toMatchObject({
      status: 422, code: "infeasible", extra: { cheapestFeasibleCents: 400, relax: ["budgetCents"] },
    });
    expect(transport).not.toHaveBeenCalled();
    expect(quotaUsed).not.toHaveBeenCalled();
    expect(tables.plans).toHaveLength(0);
  });

  it("repairs a planner answer that breaks the rules", async () => {
    transport.mockImplementationOnce(async () => ({ parsed: { setId: "set_99", meals: [], usedPreferenceIds: [], usedFridgeItemIds: [], assumptions: [] }, stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } }));
    const { plan, run } = await planning.createPlan(U1, body(), "req_1");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(plan.meals).toHaveLength(2);
    expect(run.terminated).toBe("done");
  });

  it("502 plan_invalid when repairs run out, with nothing stored and the quota given back", async () => {
    transport.mockImplementation(async () => ({ parsed: { setId: "set_1", meals: [{ recipeId: "rcp_lobster", reasons: ["x"] }], usedPreferenceIds: [], usedFridgeItemIds: [], assumptions: [] }, stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } }));
    await expect(planning.createPlan(U1, body(), "req_1")).rejects.toMatchObject({ status: 502, code: "plan_invalid" });
    expect(tables.plans).toHaveLength(0);
    expect(quotaReleased).toHaveBeenCalled();
  });

  it("a provider error stays a model_error, not plan_invalid", async () => {
    transport.mockImplementation(async () => {
      throw new Error("overloaded");
    });
    await expect(planning.createPlan(U1, body(), "req_1")).rejects.toMatchObject({ status: 502, code: "model_error" });
  });

  it("a must-use item that is not the user's is 404", async () => {
    await expect(planning.createPlan(U1, body({ mustUseItemIds: ["itm_theirs"] }), "req_1")).rejects.toMatchObject({ status: 404 });
  });
});

describe("createPlan with picked recipes (mustIncludeRecipeIds)", () => {
  it("keeps the user's pick even when a cheaper plan exists, and tells the planner", async () => {
    const { plan } = await planning.createPlan(U1, body({ mustIncludeRecipeIds: ["rcp_rice"] }), "req_1");
    expect(plan.meals.map((m) => m.recipeId)).toContain("rcp_rice");
    expect(JSON.stringify(transport.mock.calls[0][0])).toContain("<picked_by_user>\\nrcp_rice\\n</picked_by_user>");
  });

  it("a pick that breaks a hard constraint is left out and the plan says why", async () => {
    const { plan } = await planning.createPlan(U1, body({ maxMinutes: 20, mustIncludeRecipeIds: ["rcp_chicken"] }), "req_1");
    expect(plan.meals.map((m) => m.recipeId)).not.toContain("rcp_chicken");
    expect(plan.assumptions).toContain("Chicken was left out: it takes longer than your max minutes.");
  });

  it("an unknown or foreign recipe pick is 404", async () => {
    tables.recipes.push({ id: "rcp_theirs", owner_id: U2, title: "Theirs", base_servings: 2, minutes: 10, equipment: [] });
    await expect(planning.createPlan(U1, body({ mustIncludeRecipeIds: ["rcp_theirs"] }), "req_1")).rejects.toMatchObject({ status: 404 });
    await expect(planning.createPlan(U1, body({ mustIncludeRecipeIds: ["rcp_nope"] }), "req_2")).rejects.toMatchObject({ status: 404 });
  });

  it("more picks than meals is 400", async () => {
    await expect(planning.createPlan(U1, body({ meals: 2, mustIncludeRecipeIds: ["rcp_chicken", "rcp_omelette", "rcp_rice"] }), "req_1"))
      .rejects.toMatchObject({ status: 400 });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("getPlan, listPlans, savePlan", () => {
  it("reads back the saved version, lists it, and saving is immutable and idempotent", async () => {
    const { plan } = await planning.createPlan(U1, body(), "req_1");
    expect(await planning.getPlan(U1, plan.planId)).toEqual(plan);

    const list = await planning.listPlans(U1);
    expect(list.items).toHaveLength(1);
    expect(PlanSummary.safeParse(list.items[0]).success).toBe(true);
    expect(list.items[0]).toMatchObject({ planId: plan.planId, status: "draft", mealTitles: ["Chicken", "Omelette"], totalCents: 400 });

    expect(await planning.savePlan(U1, plan.planId, { version: 1 })).toEqual({ planId: plan.planId, version: 1, status: "saved" });
    const saved = await planning.getPlan(U1, plan.planId);
    expect(saved.status).toBe("saved");
    const savedAt = tables.plan_versions[0].saved_at;
    expect(await planning.savePlan(U1, plan.planId, { version: 1 })).toMatchObject({ status: "saved" });
    expect(tables.plan_versions[0].saved_at).toBe(savedAt);
  });

  it("a stale version is 409", async () => {
    const { plan } = await planning.createPlan(U1, body(), "req_1");
    await expect(planning.savePlan(U1, plan.planId, { version: 2 })).rejects.toMatchObject({ status: 409, code: "stale_version" });
  });

  it("another user's plan is 404 for get and save, and absent from their list", async () => {
    const { plan } = await planning.createPlan(U1, body(), "req_1");
    await expect(planning.getPlan(U2, plan.planId)).rejects.toMatchObject({ status: 404 });
    await expect(planning.savePlan(U2, plan.planId, { version: 1 })).rejects.toMatchObject({ status: 404 });
    expect((await planning.listPlans(U2)).items).toEqual([]);
  });
});
