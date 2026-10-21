import { describe, expect, it } from "vitest";
import type { PlanDraft } from "@spec/contract";
import { optionalExtras, pastUseBy } from "./notes";
import type { PlanningRecipe } from "./feasible";

const meals = (uses: Record<string, string[]>): PlanDraft["meals"] =>
  Object.entries(uses).map(([recipeId, ids]) => ({ recipeId, title: recipeId, reasons: ["x"], usesFridgeItemIds: ids, usesPreferenceIds: [] }));

describe("pastUseBy", () => {
  const fridge = [
    { id: "itm_old", ingredientId: "ing_chicken", qty: 200, unit: "g" as const, expiresOn: "2026-10-19" },
    { id: "itm_today", ingredientId: "ing_egg", qty: 6, unit: "count" as const, expiresOn: "2026-10-21" },
    { id: "itm_unused", ingredientId: "ing_milk", qty: 1, unit: "count" as const, expiresOn: "2026-10-01" },
    { id: "itm_nodate", ingredientId: "ing_rice", qty: 500, unit: "g" as const, expiresOn: null },
  ];
  const names = new Map([["ing_chicken", "Chicken"]]);

  it("lists only used items dated before today, with the meals that use them", () => {
    const plan = { meals: meals({ rcp_a: ["itm_old", "itm_today", "itm_nodate"], rcp_b: ["itm_old"] }) };
    expect(pastUseBy(plan, fridge, names, "2026-10-21")).toEqual([
      { itemId: "itm_old", name: "Chicken", expiresOn: "2026-10-19", recipeIds: ["rcp_a", "rcp_b"] },
    ]);
  });

  it("nothing past date: empty", () => {
    expect(pastUseBy({ meals: meals({ rcp_a: ["itm_today"] }) }, fridge, names, "2026-10-21")).toEqual([]);
  });
});

describe("optionalExtras", () => {
  const recipes: PlanningRecipe[] = [
    { id: "rcp_frittata", title: "Frittata", baseServings: 2, minutes: 20, equipment: [], ingredients: [
      { ingredientId: "ing_egg", qty: 6, unit: "count" },
      { ingredientId: "ing_parmesan", qty: 40, unit: "g", optional: true },
    ] },
    { id: "rcp_rice", title: "Fried rice", baseServings: 2, minutes: 20, equipment: [], ingredients: [
      { ingredientId: "ing_egg", qty: 2, unit: "count", optional: true },
      { ingredientId: "ing_peas", qty: 100, unit: "g", optional: true },
    ] },
    { id: "rcp_other", title: "Not in plan", baseServings: 2, minutes: 20, equipment: [], ingredients: [
      { ingredientId: "ing_truffle", qty: 5, unit: "g", optional: true },
    ] },
  ];
  const ingredients = ["egg", "parmesan", "peas", "truffle"].map((n) => ({ id: `ing_${n}`, name: n, allergenTags: [] }));
  const products = [
    { id: "prd_parm", ingredientId: "ing_parmesan", packageSize: 170, unit: "g" as const, priceCents: 499 },
    { id: "prd_peas", ingredientId: "ing_peas", packageSize: 454, unit: "g" as const, priceCents: 199 },
    { id: "prd_egg", ingredientId: "ing_egg", packageSize: 12, unit: "count" as const, priceCents: 349 },
  ];
  // The main list bought a dozen eggs for 6: 6 left over.
  const shopping = { items: [{ ingredientId: "ing_egg", name: "egg", needQty: 6, unit: "count" as const, haveQty: 0, buyQty: 6, packages: 1, packageSize: 12, packageCents: 349, costCents: 349, leftoverQty: 6, forRecipeIds: ["rcp_frittata"] }], totalCents: 349, unpricedIngredientIds: [] };
  const plan = { servings: 2, shopping, meals: meals({ rcp_frittata: [], rcp_rice: [] }) };

  it("prices the optional ingredients of the plan's meals, outside its total", () => {
    const x = optionalExtras(plan, recipes, ingredients, products, [], []);
    expect(x.items.map((i) => [i.ingredientId, i.packages, i.costCents, i.forRecipeIds])).toEqual([
      ["ing_parmesan", 1, 499, ["rcp_frittata"]],
      ["ing_egg", 0, 0, ["rcp_rice"]],   // covered by the 6 eggs the main list leaves over
      ["ing_peas", 1, 199, ["rcp_rice"]],
    ]);
    expect(x.totalCents).toBe(698);
    expect(plan.shopping.totalCents).toBe(349); // the plan total is untouched
  });

  it("uses fridge stock and staples for extras not on the main list", () => {
    const fridge = [{ id: "itm_peas", ingredientId: "ing_peas", qty: 100, unit: "g" as const, expiresOn: null }];
    const x = optionalExtras(plan, recipes, ingredients, products, fridge, ["ing_parmesan"]);
    expect(x.totalCents).toBe(0);
  });

  it("an extra with no price is unknown, never $0", () => {
    const x = optionalExtras(plan, recipes, ingredients, products.filter((p) => p.id !== "prd_peas"), [], []);
    expect(x.unpricedIngredientIds).toEqual(["ing_peas"]);
    expect(x.items.find((i) => i.ingredientId === "ing_peas")?.costCents).toBeNull();
  });

  it("no optional ingredients: an empty list", () => {
    const x = optionalExtras({ ...plan, meals: meals({ rcp_none: [] }) }, recipes, ingredients, products, [], []);
    expect(x).toEqual({ items: [], totalCents: 0, unpricedIngredientIds: [] });
  });
});
