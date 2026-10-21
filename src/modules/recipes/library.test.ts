import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ingredient, Recipe, RecipeSummary } from "@spec/contract";
import { fakeDb } from "../planning/fake-db";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

let tables: Record<string, Record<string, unknown>[]> = {};
let db = fakeDb(tables);
vi.mock("@/platform/db", () => ({ reader: async () => db, writer: (userId: string) => ({ db, userId }) }));
const cookNow = vi.fn();
vi.mock("@/modules/fridge", () => ({ cookNow: (...a: unknown[]) => cookNow(...a) }));
const recipes = await import("./index");

const recipe = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id, owner_id: null, title, base_servings: 2, minutes: 20, equipment: ["skillet"], tags: ["dinner"],
  source_url: null, source_label: "Cooky team recipe", image_url: null, ...over,
});

beforeEach(() => {
  tables = {
    recipes: [
      recipe("rcp_fried_rice", "Egg fried rice", { tags: ["dinner", "quick"] }),
      recipe("rcp_salmon", "Honey garlic salmon", { minutes: 25 }),
      recipe("rcp_mine", "My secret stew", { owner_id: U1 }),
      recipe("rcp_theirs", "Their secret stew", { owner_id: U2 }),
    ],
    recipe_ingredients: [
      { recipe_id: "rcp_fried_rice", ingredient_id: "ing_rice", qty: "150", unit: "g", optional: false, note: "uncooked" },
      { recipe_id: "rcp_fried_rice", ingredient_id: "ing_egg", qty: 3, unit: "count", optional: false, note: null },
      { recipe_id: "rcp_salmon", ingredient_id: "ing_salmon", qty: 340, unit: "g", optional: false, note: null },
    ],
    ingredients: [
      { id: "ing_rice", owner_id: null, name: "Jasmine rice", aliases: ["RICE"], category: "pantry", base_unit: "g", allergen_tags: [], shelf_life_days: { pantry: 730 }, shelf_life_source: "FoodKeeper #338" },
      { id: "ing_egg", owner_id: null, name: "Eggs", aliases: ["EGGS"], category: "eggs", base_unit: "count", allergen_tags: ["egg"], shelf_life_days: { fridge: 21 }, shelf_life_source: "FoodKeeper #21" },
      { id: "ing_salmon", owner_id: null, name: "Salmon fillet", aliases: [], category: "seafood", base_unit: "g", allergen_tags: ["fish"], shelf_life_days: { fridge: 1 }, shelf_life_source: "FoodKeeper #146" },
      { id: "ing_their_custom", owner_id: U2, name: "Their sauce", aliases: [], category: "other", base_unit: "ml", allergen_tags: [], shelf_life_days: {}, shelf_life_source: "" },
    ],
    recipe_chunks: [
      { id: "chk_fried_rice_f1", recipe_id: "rcp_fried_rice", kind: "faq", step_no: null, label: "FAQ: no wok", text: "A wide skillet works.", timer_seconds: null },
      { id: "chk_fried_rice_s2", recipe_id: "rcp_fried_rice", kind: "step", step_no: 2, label: "Step 2", text: "Add the cold rice.", timer_seconds: 60 },
      { id: "chk_fried_rice_t1", recipe_id: "rcp_fried_rice", kind: "tip", step_no: 1, label: "Tip", text: "Slice the scallions first.", timer_seconds: null },
      { id: "chk_fried_rice_s1", recipe_id: "rcp_fried_rice", kind: "step", step_no: 1, label: "Step 1", text: "Scramble the eggs.", timer_seconds: null },
    ],
  };
  db = fakeDb(tables);
  cookNow.mockReset();
});

describe("recipes.list (RCP3)", () => {
  it("lists curated and own recipes, never another user's, as contract summaries", async () => {
    const { items } = await recipes.list(U1, {});
    expect(items.map((r) => r.id)).toEqual(["rcp_fried_rice", "rcp_salmon", "rcp_mine"]);
    for (const r of items) expect(RecipeSummary.safeParse(r).success).toBe(true);
    expect(items.find((r) => r.id === "rcp_mine")?.custom).toBe(true);
  });
  it("searches titles, tags and ingredient names, and filters by tag", async () => {
    expect((await recipes.list(U1, { q: "salmon" })).items.map((r) => r.id)).toEqual(["rcp_salmon"]);
    expect((await recipes.list(U1, { q: "eggs" })).items.map((r) => r.id)).toEqual(["rcp_fried_rice"]);
    expect((await recipes.list(U1, { tag: "quick" })).items.map((r) => r.id)).toEqual(["rcp_fried_rice"]);
  });
  it("cookable now keeps only fully covered recipes, in Fridge's order", async () => {
    cookNow.mockResolvedValue([
      { recipeId: "rcp_salmon", coverage: 1 },
      { recipeId: "rcp_fried_rice", coverage: 0.5 },
    ]);
    expect((await recipes.list(U1, { cookableNow: "true" })).items.map((r) => r.id)).toEqual(["rcp_salmon"]);
    expect(cookNow).toHaveBeenCalledWith(U1);
  });
  it("fails loud when the database errors", async () => {
    db = fakeDb(tables, { fail: ["recipes"] });
    await expect(recipes.list(U1, {})).rejects.toMatchObject({ status: 502 });
  });
});

describe("recipes.get (RCP3)", () => {
  it("returns ingredients with names, steps with tips in order, and FAQs", async () => {
    const r = await recipes.get(U1, "rcp_fried_rice");
    expect(Recipe.safeParse(r).success).toBe(true);
    expect(r.ingredients[0]).toMatchObject({ ingredientId: "ing_rice", name: "Jasmine rice", qty: 150, note: "uncooked" });
    expect(r.steps.map((s) => s.id)).toEqual(["chk_fried_rice_s1", "chk_fried_rice_t1", "chk_fried_rice_s2"]);
    expect(r.steps[2].timerSeconds).toBe(60);
    expect(r.faqs.map((f) => f.id)).toEqual(["chk_fried_rice_f1"]);
  });
  it("404s for an unknown recipe or another user's import", async () => {
    await expect(recipes.get(U1, "rcp_nope")).rejects.toMatchObject({ status: 404 });
    await expect(recipes.get(U1, "rcp_theirs")).rejects.toMatchObject({ status: 404 });
  });
});

describe("recipes.listIngredients (RCP2)", () => {
  it("returns the catalog without other users' custom ingredients, searchable by alias", async () => {
    const { items } = await recipes.listIngredients(U1, undefined);
    expect(items.map((i) => i.id)).toEqual(["ing_egg", "ing_rice", "ing_salmon"]);
    for (const i of items) expect(Ingredient.safeParse(i).success).toBe(true);
    expect((await recipes.listIngredients(U1, "rice")).items.map((i) => i.id)).toEqual(["ing_rice"]);
  });
});

describe("recipes.retrieveChunks (ASK2)", () => {
  it("ranks one recipe's chunks for a question", async () => {
    const top = await recipes.retrieveChunks("rcp_fried_rice", "I have no wok");
    expect(top[0].id).toBe("chk_fried_rice_f1");
    expect(top.every((c) => c.recipeId === "rcp_fried_rice")).toBe(true);
  });
});

describe("perServingCents (library cards)", () => {
  it("prices the share of each package a serving uses, at the cheapest rate", () => {
    const products = [
      { ingredientId: "ing_rice", packageSize: 1000, priceCents: 400 },
      { ingredientId: "ing_rice", packageSize: 500, priceCents: 300 },
      { ingredientId: "ing_egg", packageSize: 12, priceCents: 600 },
    ];
    // 150 g rice at 0.4 c/g = 60, 3 eggs at 50 c = 150; 210 for 2 servings
    expect(recipes.perServingCents([{ ingredientId: "ing_rice", qty: 150, optional: false }, { ingredientId: "ing_egg", qty: 3, optional: false }], products, 2)).toBe(105);
  });
  it("ignores optional ingredients and is null when a required one has no price", () => {
    expect(recipes.perServingCents([{ ingredientId: "ing_peas", qty: 100, optional: true }], [], 2)).toBe(0);
    expect(recipes.perServingCents([{ ingredientId: "ing_saffron", qty: 1, optional: false }], [], 2)).toBeNull();
  });
});
