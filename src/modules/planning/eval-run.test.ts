import { describe, expect, it } from "vitest";
import { CalcCase, PlansCase, scoreCalc, scorePlans, seedCatalog, violations } from "./eval-run";

// The checkers must catch what they claim to catch, or a 100% score means nothing.
const catalog = seedCatalog();

describe("seedCatalog", () => {
  it("reads every seed recipe with its ingredients, and every product price", () => {
    expect(catalog.recipes.length).toBeGreaterThanOrEqual(20);
    expect(catalog.recipes.every((r) => r.ingredients.length > 0)).toBe(true);
    expect(catalog.products.every((p) => Number.isInteger(p.priceCents) && p.packageSize > 0)).toBe(true);
    expect(catalog.priceAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("scoreCalc", () => {
  const base = CalcCase.parse({
    id: "x", recipes: ["rcp_lemon_garlic_chicken"], servings: 2,
    expect: { items: [
      { ingredientId: "ing_chicken_breast", packages: 1, costCents: 749, leftoverQty: 54 },
      { ingredientId: "ing_spinach", packages: 1, costCents: 229, leftoverQty: 20 },
      { ingredientId: "ing_garlic", packages: 1, costCents: 50, leftoverQty: 7 },
      { ingredientId: "ing_lemon", packages: 1, costCents: 349, leftoverQty: 5 },
      { ingredientId: "ing_olive_oil", packages: 1, costCents: 1099, leftoverQty: 970 },
    ], totalCents: 2476 },
  });

  it("passes an exact answer", () => {
    expect(scoreCalc([base], catalog).exactRate).toBe(1);
  });

  it("fails a wrong package count, a wrong total, a missing and an extra line", () => {
    const wrong = { ...base, expect: { items: [{ ...base.expect.items[0], packages: 2 }, ...base.expect.items.slice(1, 4), { ingredientId: "ing_truffle", packages: 1, costCents: 1, leftoverQty: 0 }], totalCents: 2477 } };
    const { rows, exactRate } = scoreCalc([wrong], catalog);
    expect(exactRate).toBe(0);
    expect(rows[0].diffs.join(" | ")).toMatch(/ing_chicken_breast.packages: expected 2, got 1/);
    expect(rows[0].diffs.join(" | ")).toMatch(/ing_truffle: expected on the list, missing/);
    expect(rows[0].diffs.join(" | ")).toMatch(/ing_olive_oil: on the list but not expected/);
    expect(rows[0].diffs.join(" | ")).toMatch(/totalCents: expected 2477, got 2476/);
  });
});

describe("plans checker (violations)", () => {
  const c = PlansCase.parse({
    id: "x", input: { servings: 2, budgetCents: 3000, maxMinutes: 25, meals: 2, mustIncludeRecipeIds: ["rcp_beef_tacos"] },
    forbiddenIngredientIds: ["ing_chicken_breast"], forbiddenAllergens: ["egg"],
    expectRecipeIds: ["rcp_beef_tacos"], expectUsesIngredientIds: ["ing_chicken_thigh"], expectInfeasible: false,
  });

  it("flags every kind of broken plan", () => {
    const v = violations(c, { recipeIds: ["rcp_lemon_garlic_chicken", "rcp_lemon_garlic_chicken", "rcp_frittata_nope"], totalCents: 3100 }, catalog);
    const all = v.join(" | ");
    expect(all).toMatch(/unknown recipe rcp_frittata_nope/);
    expect(all).toMatch(/appears twice/);
    expect(all).toMatch(/3 meals for 2 asked/);
    expect(all).toMatch(/over budget/);
    expect(all).toMatch(/takes 30 min \(max 25\)/);
    expect(all).toMatch(/uses forbidden ing_chicken_breast/);
    expect(all).toMatch(/picked rcp_beef_tacos is missing/);
    expect(all).toMatch(/no meal uses must-use ing_chicken_thigh/);
    expect(violations(c, { recipeIds: ["rcp_beef_tacos", "rcp_tomato_egg_stir_fry"], totalCents: 2000 }, catalog).join(" | ")).toMatch(/allergen egg/);
  });

  it("an honest infeasible answer is not a shown plan; a plan where infeasible was expected fails", () => {
    const inf = { ...c, expectInfeasible: true };
    const r = scorePlans([inf, inf], [{ kind: "infeasible", relax: ["budgetCents"] }, { kind: "plan", recipeIds: ["rcp_beef_tacos"], totalCents: 1 }], catalog);
    expect(r.rows.map((x) => x.pass)).toEqual([true, false]);
    expect(r.infeasibleHonestyRate).toBe(0.5);
  });
});
