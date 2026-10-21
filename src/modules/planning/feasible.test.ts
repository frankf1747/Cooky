import { describe, expect, it } from "vitest";
import { findFeasibleSets, type FeasibleInput, type PlanningRecipe } from "./feasible";

const ingredients = [
  { id: "ing_chicken", name: "Chicken", allergenTags: [] },
  { id: "ing_egg", name: "Egg", allergenTags: ["egg"] },
  { id: "ing_rice", name: "Rice", allergenTags: [] },
  { id: "ing_peanut", name: "Peanut", allergenTags: ["peanut"] },
  { id: "ing_tofu", name: "Tofu", allergenTags: ["soy"] },
];
const products = [
  { id: "prd_chicken", ingredientId: "ing_chicken", packageSize: 500, unit: "g" as const, priceCents: 800 },
  { id: "prd_egg", ingredientId: "ing_egg", packageSize: 12, unit: "count" as const, priceCents: 400 },
  { id: "prd_rice", ingredientId: "ing_rice", packageSize: 1000, unit: "g" as const, priceCents: 300 },
  { id: "prd_peanut", ingredientId: "ing_peanut", packageSize: 200, unit: "g" as const, priceCents: 250 },
  { id: "prd_tofu", ingredientId: "ing_tofu", packageSize: 400, unit: "g" as const, priceCents: 350 },
];

const r = (id: string, minutes: number, ings: [string, number, "g" | "count"][], equipment: string[] = []): PlanningRecipe => ({
  id, title: id, baseServings: 2, minutes, equipment,
  ingredients: ings.map(([ingredientId, qty, unit]) => ({ ingredientId, qty, unit })),
});
const chicken = r("rcp_chicken", 30, [["ing_chicken", 400, "g"]]); // 800
const omelette = r("rcp_omelette", 10, [["ing_egg", 3, "count"]]); // 400
const friedRice = r("rcp_fried_rice", 20, [["ing_rice", 300, "g"], ["ing_egg", 2, "count"]], ["wok"]); // 700 alone
const satay = r("rcp_satay", 40, [["ing_chicken", 300, "g"], ["ing_peanut", 50, "g"]]); // 1050
const tofu = r("rcp_tofu", 15, [["ing_tofu", 400, "g"]]); // 350

function input(over: Partial<FeasibleInput> = {}): FeasibleInput {
  return {
    servings: 2, budgetCents: 5000, maxMinutes: 60, meals: 2, mustUseItemIds: [],
    recipes: [chicken, omelette, friedRice, satay, tofu], ingredients, products, fridge: [],
    profile: { excludedIngredientIds: [], allergenTags: [], equipment: [], stapleIngredientIds: [] },
    hardPreferences: [],
    ...over,
  };
}
const ids = (res: ReturnType<typeof findFeasibleSets>) => (res.ok ? res.sets.map((s) => s.recipeIds.join("+")) : []);

describe("findFeasibleSets (PLN2)", () => {
  it("enumerates distinct-recipe sets that fit the budget, cheapest first, with stable ids", () => {
    const res = findFeasibleSets(input({ budgetCents: 800 }));
    expect(res.ok).toBe(true);
    // omelette+tofu 750, omelette+fried rice share the egg dozen: 400 + 300 = 700
    expect(ids(res)).toEqual(["rcp_omelette+rcp_fried_rice", "rcp_omelette+rcp_tofu"]);
    if (res.ok) {
      expect(res.sets.map((s) => s.setId)).toEqual(["set_1", "set_2"]);
      expect(res.sets[0].totalCents).toBe(700);
      expect(res.sets[0].shopping.totalCents).toBe(700);
      expect(new Set(res.sets[0].recipeIds).size).toBe(2);
    }
  });

  it("filters by max minutes", () => {
    const res = findFeasibleSets(input({ maxMinutes: 20 }));
    expect(ids(res).every((s) => !s.includes("rcp_chicken") && !s.includes("rcp_satay"))).toBe(true);
  });

  it("filters out excluded ingredients", () => {
    const res = findFeasibleSets(input({ profile: { ...input().profile, excludedIngredientIds: ["ing_egg"] } }));
    expect(ids(res).some((s) => s.includes("omelette") || s.includes("fried_rice"))).toBe(false);
  });

  it("filters out allergens, including in optional ingredients", () => {
    const withOptionalPeanut: PlanningRecipe = { ...tofu, ingredients: [...tofu.ingredients, { ingredientId: "ing_peanut", qty: 10, unit: "g", optional: true }] };
    const res = findFeasibleSets(input({
      recipes: [chicken, omelette, withOptionalPeanut, satay],
      profile: { ...input().profile, allergenTags: ["peanut"] },
    }));
    expect(ids(res)).toEqual(["rcp_chicken+rcp_omelette"]);
  });

  it("filters by equipment only when the user listed some", () => {
    expect(ids(findFeasibleSets(input())).some((s) => s.includes("fried_rice"))).toBe(true);
    const res = findFeasibleSets(input({ profile: { ...input().profile, equipment: ["skillet"] } }));
    expect(ids(res).some((s) => s.includes("fried_rice"))).toBe(false);
  });

  it("treats confirmed hard preferences as filters (recipe-scoped and ingredient)", () => {
    const res = findFeasibleSets(input({
      hardPreferences: [
        { id: "prf_1", category: "texture", value: "not dry", scopeRecipeId: "rcp_chicken" },
        { id: "prf_2", category: "ingredient", value: "Tofu", scopeRecipeId: null },
      ],
    }));
    expect(ids(res).some((s) => s.includes("rcp_chicken") || s.includes("rcp_tofu"))).toBe(false);
  });

  it("requires every must-use fridge item, and lists the fridge items a set uses", () => {
    const fridge = [
      { id: "itm_chicken", ingredientId: "ing_chicken", qty: 400, unit: "g" as const, expiresOn: "2026-10-22" },
      { id: "itm_rice", ingredientId: "ing_rice", qty: 1000, unit: "g" as const, expiresOn: null },
    ];
    const res = findFeasibleSets(input({ fridge, mustUseItemIds: ["itm_chicken"] }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sets.every((s) => s.recipeIds.includes("rcp_chicken") || s.recipeIds.includes("rcp_satay"))).toBe(true);
      expect(res.sets[0].usesFridgeItemIds).toContain("itm_chicken");
    }
  });

  it("fridge stock lowers cost, so sets using it rank first", () => {
    const fridge = [{ id: "itm_chicken", ingredientId: "ing_chicken", qty: 400, unit: "g" as const, expiresOn: "2026-10-22" }];
    const res = findFeasibleSets(input({ fridge }));
    expect(res.ok && res.sets[0].recipeIds).toContain("rcp_chicken");
    expect(res.ok && res.sets[0].usesFridgeItemIds).toEqual(["itm_chicken"]);
  });

  it("does not offer sets with an unknown price", () => {
    const res = findFeasibleSets(input({ products: products.filter((p) => p.id !== "prd_tofu") }));
    expect(ids(res).some((s) => s.includes("rcp_tofu"))).toBe(false);
  });
});

describe("findFeasibleSets infeasible (PLN4)", () => {
  it("over budget: returns the cheapest total and says to relax the budget", () => {
    const res = findFeasibleSets(input({ budgetCents: 500 }));
    expect(res).toEqual({ ok: false, cheapestFeasibleCents: 700, relax: ["budgetCents"], droppedPicks: [] });
  });

  it("over budget but fewer meals would fit: also suggests fewer meals", () => {
    // cheapest 3-meal set is 1050 (omelette + fried rice + tofu); the 2-meal set at 700 fits
    const res = findFeasibleSets(input({ meals: 3, budgetCents: 700 }));
    expect(res).toEqual({ ok: false, cheapestFeasibleCents: 1050, relax: ["budgetCents", "meals"], droppedPicks: [] });
  });

  it("too few recipes pass the filters: no estimate, names the constraint to relax", () => {
    const res = findFeasibleSets(input({ maxMinutes: 10 }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.cheapestFeasibleCents).toBeNull();
      expect(res.relax).toContain("maxMinutes");
      expect(res.relax).toContain("meals");
    }
  });

  it("must-use item no candidate uses", () => {
    const fridge = [{ id: "itm_peanut", ingredientId: "ing_peanut", qty: 100, unit: "g" as const, expiresOn: null }];
    const res = findFeasibleSets(input({ fridge, mustUseItemIds: ["itm_peanut"], maxMinutes: 30 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.relax).toEqual(expect.arrayContaining(["maxMinutes", "mustUseItemIds"]));
  });

  it("never returns a set that breaks a hard constraint", () => {
    const res = findFeasibleSets(input({
      budgetCents: 2000, maxMinutes: 30,
      profile: { excludedIngredientIds: ["ing_rice"], allergenTags: ["soy"], equipment: [], stapleIngredientIds: [] },
    }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      for (const s of res.sets) {
        expect(s.totalCents).toBeLessThanOrEqual(2000);
        expect(s.recipeIds).not.toContain("rcp_fried_rice");
        expect(s.recipeIds).not.toContain("rcp_tofu");
        expect(s.recipeIds).not.toContain("rcp_satay");
      }
    }
  });
});

describe("findFeasibleSets with picked recipes (PLN1 mustIncludeRecipeIds)", () => {
  it("every set contains the picks; the planner only fills the other meals", () => {
    const res = findFeasibleSets(input({ meals: 3, mustIncludeRecipeIds: ["rcp_satay"] }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sets.length).toBeGreaterThan(0);
      expect(res.sets.every((s) => s.recipeIds.includes("rcp_satay") && s.recipeIds.length === 3)).toBe(true);
      expect(res.droppedPicks).toEqual([]);
    }
  });

  it("a pick even when it is not the cheapest: picks are not traded for price", () => {
    const res = findFeasibleSets(input({ mustIncludeRecipeIds: ["rcp_satay"] }));
    expect(res.ok && res.sets[0].recipeIds).toContain("rcp_satay");
  });

  it("picks filling every meal give exactly one set", () => {
    const res = findFeasibleSets(input({ mustIncludeRecipeIds: ["rcp_tofu", "rcp_omelette"] }));
    expect(ids(res)).toEqual(["rcp_omelette+rcp_tofu"]);
  });

  it("a pick that breaks a hard constraint is dropped and reported, and the meal is filled", () => {
    const res = findFeasibleSets(input({ maxMinutes: 30, mustIncludeRecipeIds: ["rcp_satay", "rcp_tofu"] }));
    expect(res.droppedPicks).toEqual([{ recipeId: "rcp_satay", because: "maxMinutes" }]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.sets.every((s) => s.recipeIds.includes("rcp_tofu") && !s.recipeIds.includes("rcp_satay"))).toBe(true);
  });

  it("over budget only because of a pick: says the pick is what to relax", () => {
    // satay alone is 1050; any 2-meal set with it costs more than 1100, without it 700 fits
    const res = findFeasibleSets(input({ budgetCents: 1100, mustIncludeRecipeIds: ["rcp_satay"] }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.relax).toEqual(["budgetCents", "mustIncludeRecipeIds"]);
  });

  it("duplicate picks count once", () => {
    const res = findFeasibleSets(input({ mustIncludeRecipeIds: ["rcp_tofu", "rcp_tofu"] }));
    expect(res.ok && res.sets.every((s) => s.recipeIds.filter((r) => r === "rcp_tofu").length === 1)).toBe(true);
  });
});
