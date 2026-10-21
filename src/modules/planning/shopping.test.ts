import { describe, expect, it } from "vitest";
import { ShoppingList } from "@spec/contract";
import { buildShoppingList, type ShoppingInput } from "./shopping";

const chicken = { id: "ing_chicken_breast", name: "Chicken breast" };
const spinach = { id: "ing_spinach", name: "Baby spinach" };
const lemon = { id: "ing_lemon", name: "Lemon" };
const salt = { id: "ing_salt", name: "Salt" };

function input(over: Partial<ShoppingInput>): ShoppingInput {
  return {
    servings: 2,
    recipes: [],
    ingredients: [chicken, spinach, lemon, salt],
    products: [],
    fridge: [],
    stapleIngredientIds: [],
    ...over,
  };
}

describe("buildShoppingList (PLN3)", () => {
  it("SPEC example: need 700 g, have 200 g, 400 g packs at 500 cents → 2 packs, 1000 cents, 300 g left", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: chicken.id, qty: 700, unit: "g" }] }],
      products: [{ id: "prd_c400", ingredientId: chicken.id, packageSize: 400, unit: "g", priceCents: 500 }],
      fridge: [{ ingredientId: chicken.id, qty: 200, unit: "g" }],
    }));
    expect(list.items).toEqual([{
      ingredientId: chicken.id, name: "Chicken breast", unit: "g",
      needQty: 700, haveQty: 200, buyQty: 500,
      packages: 2, packageSize: 400, packageCents: 500, costCents: 1000,
      leftoverQty: 300, forRecipeIds: ["rcp_a"],
    }]);
    expect(list.totalCents).toBe(1000);
    expect(list.unpricedIngredientIds).toEqual([]);
    expect(ShoppingList.safeParse(list).success).toBe(true);
  });

  it("scales by servings ÷ base servings", () => {
    const list = buildShoppingList(input({
      servings: 3,
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: chicken.id, qty: 400, unit: "g" }] }],
      products: [{ id: "prd_c600", ingredientId: chicken.id, packageSize: 600, unit: "g", priceCents: 799 }],
    }));
    expect(list.items[0]).toMatchObject({ needQty: 600, buyQty: 600, packages: 1, costCents: 799, leftoverQty: 0 });
  });

  it("merges the same ingredient across recipes and lists every recipe that needs it", () => {
    const list = buildShoppingList(input({
      recipes: [
        { id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: spinach.id, qty: 150, unit: "g" }] },
        { id: "rcp_b", baseServings: 2, ingredients: [{ ingredientId: spinach.id, qty: 100, unit: "g" }] },
      ],
      products: [{ id: "prd_s170", ingredientId: spinach.id, packageSize: 170, unit: "g", priceCents: 229 }],
    }));
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ needQty: 250, packages: 2, costCents: 458, leftoverQty: 90, forRecipeIds: ["rcp_a", "rcp_b"] });
  });

  it("buys nothing when the fridge already covers the need", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: chicken.id, qty: 300, unit: "g" }] }],
      products: [{ id: "prd_c400", ingredientId: chicken.id, packageSize: 400, unit: "g", priceCents: 500 }],
      fridge: [{ ingredientId: chicken.id, qty: 250, unit: "g" }, { ingredientId: chicken.id, qty: 100, unit: "g" }],
    }));
    expect(list.items[0]).toMatchObject({ haveQty: 350, buyQty: 0, packages: 0, costCents: 0, leftoverQty: 50 });
    expect(list.totalCents).toBe(0);
  });

  it("ignores fridge stock in a different unit", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: lemon.id, qty: 1, unit: "count" }] }],
      products: [{ id: "prd_l1", ingredientId: lemon.id, packageSize: 1, unit: "count", priceCents: 69 }],
      fridge: [{ ingredientId: lemon.id, qty: 50, unit: "g" }],
    }));
    expect(list.items[0]).toMatchObject({ haveQty: 0, buyQty: 1, packages: 1, costCents: 69 });
  });

  it("treats staples as on hand", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: salt.id, qty: 5, unit: "g" }] }],
      products: [{ id: "prd_salt", ingredientId: salt.id, packageSize: 500, unit: "g", priceCents: 199 }],
      stapleIngredientIds: [salt.id],
    }));
    expect(list.items[0]).toMatchObject({ needQty: 5, haveQty: 5, buyQty: 0, packages: 0, costCents: 0, leftoverQty: 0 });
  });

  it("picks the product with the cheapest total for the amount to buy", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: chicken.id, qty: 900, unit: "g" }] }],
      products: [
        { id: "prd_c400", ingredientId: chicken.id, packageSize: 400, unit: "g", priceCents: 500 }, // 3 × 500 = 1500
        { id: "prd_c1000", ingredientId: chicken.id, packageSize: 1000, unit: "g", priceCents: 1100 }, // 1 × 1100
      ],
    }));
    expect(list.items[0]).toMatchObject({ packages: 1, packageSize: 1000, packageCents: 1100, costCents: 1100, leftoverQty: 100 });
  });

  it("on equal cost, prefers less leftover", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: chicken.id, qty: 400, unit: "g" }] }],
      products: [
        { id: "prd_c600", ingredientId: chicken.id, packageSize: 600, unit: "g", priceCents: 600 },
        { id: "prd_c400", ingredientId: chicken.id, packageSize: 400, unit: "g", priceCents: 600 },
      ],
    }));
    expect(list.items[0]).toMatchObject({ packageSize: 400, leftoverQty: 0 });
  });

  it("an unknown price is null and listed, never counted as zero", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [
        { ingredientId: lemon.id, qty: 2, unit: "count" },
        { ingredientId: chicken.id, qty: 400, unit: "g" },
      ] }],
      products: [{ id: "prd_c400", ingredientId: chicken.id, packageSize: 400, unit: "g", priceCents: 500 }],
    }));
    const lemonItem = list.items.find((i) => i.ingredientId === lemon.id)!;
    expect(lemonItem).toMatchObject({ buyQty: 2, packages: 0, packageSize: null, packageCents: null, costCents: null, leftoverQty: 0 });
    expect(list.unpricedIngredientIds).toEqual([lemon.id]);
    expect(list.totalCents).toBe(500);
  });

  it("does not use products sold in another unit", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: lemon.id, qty: 1, unit: "count" }] }],
      products: [{ id: "prd_l_bag", ingredientId: lemon.id, packageSize: 900, unit: "g", priceCents: 399 }],
    }));
    expect(list.items[0].costCents).toBeNull();
    expect(list.unpricedIngredientIds).toEqual([lemon.id]);
  });

  it("skips optional ingredients", () => {
    const list = buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: lemon.id, qty: 1, unit: "count", optional: true }] }],
    }));
    expect(list.items).toEqual([]);
  });

  it("rounds scaled fractions safely before counting packages", () => {
    // 0.1 × 3 = 0.30000000000000004 must not become two packages of 0.3
    const list = buildShoppingList(input({
      servings: 3,
      recipes: [{ id: "rcp_a", baseServings: 1, ingredients: [{ ingredientId: spinach.id, qty: 0.1, unit: "g" }] }],
      products: [{ id: "prd_s", ingredientId: spinach.id, packageSize: 0.3, unit: "g", priceCents: 100 }],
    }));
    expect(list.items[0]).toMatchObject({ needQty: 0.3, packages: 1, leftoverQty: 0 });
  });

  it("throws on an ingredient missing from the catalog rather than guessing a name", () => {
    expect(() => buildShoppingList(input({
      recipes: [{ id: "rcp_a", baseServings: 2, ingredients: [{ ingredientId: "ing_mystery", qty: 1, unit: "count" }] }],
    }))).toThrow(/ing_mystery/);
  });
});
