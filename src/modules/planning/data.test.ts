import { describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the Supabase query builder: eq, in, or(is.null / eq), maybeSingle.
// It does NOT apply RLS, so these tests prove the code filters by the session user itself.
type Row = Record<string, unknown>;
const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

let tables: Record<string, Row[]> = {};
let failTable: string | null = null;

function query(table: string) {
  const preds: ((r: Row) => boolean)[] = [];
  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => (preds.push((r) => r[c] === v), q),
    in: (c: string, vs: unknown[]) => (preds.push((r) => vs.includes(r[c])), q),
    or: (expr: string) => {
      const alts = expr.split(",").map((part) => {
        const [c, op, ...rest] = part.split(".");
        const v = rest.join(".");
        return (r: Row) => (op === "is" && v === "null" ? r[c] == null : op === "eq" ? r[c] === v : false);
      });
      preds.push((r) => alts.some((a) => a(r)));
      return q;
    },
    result: () =>
      failTable === table
        ? { data: null, error: { message: `boom in ${table}` } }
        : { data: (tables[table] ?? []).filter((r) => preds.every((p) => p(r))), error: null },
    maybeSingle: async () => {
      const res = q.result();
      return res.error ? res : { data: res.data?.[0] ?? null, error: null };
    },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(q.result()).then(ok, bad),
  };
  return q;
}
const fakeDb = { from: query };
vi.mock("@/platform/db", () => ({
  reader: async () => fakeDb,
  writer: () => {
    throw new Error("writer used for a read");
  },
}));

const { loadPlanningData } = await import("./data");
const { priceRecipes } = await import("./index");

function seed() {
  failTable = null;
  tables = {
    recipes: [
      { id: "rcp_curated", owner_id: null, title: "Curated", base_servings: 2, minutes: 20, equipment: ["skillet"] },
      { id: "rcp_mine", owner_id: U1, title: "Mine", base_servings: 1, minutes: 10, equipment: [] },
      { id: "rcp_theirs", owner_id: U2, title: "Theirs", base_servings: 2, minutes: 10, equipment: [] },
    ],
    recipe_ingredients: [
      { recipe_id: "rcp_curated", ingredient_id: "ing_chicken", qty: "700", unit: "g", optional: false },
      { recipe_id: "rcp_mine", ingredient_id: "ing_egg", qty: 2, unit: "count", optional: false },
      { recipe_id: "rcp_theirs", ingredient_id: "ing_egg", qty: 2, unit: "count", optional: false },
    ],
    ingredients: [
      { id: "ing_chicken", name: "Chicken", allergen_tags: [] },
      { id: "ing_egg", name: "Egg", allergen_tags: ["egg"] },
    ],
    products: [
      { id: "prd_chicken", ingredient_id: "ing_chicken", package_size: "400", unit: "g", price_cents: 500, price_date: "2026-10-18" },
      { id: "prd_egg", ingredient_id: "ing_egg", package_size: 12, unit: "count", price_cents: 400, price_date: "2026-10-20" },
    ],
    fridge_items: [
      { id: "itm_a", user_id: U1, kind: "ingredient", status: "active", ingredient_id: "ing_chicken", qty: "200", unit: "g", expires_on: "2026-10-22" },
      { id: "itm_used", user_id: U1, kind: "ingredient", status: "used", ingredient_id: "ing_chicken", qty: 900, unit: "g", expires_on: null },
      { id: "itm_other", user_id: U2, kind: "ingredient", status: "active", ingredient_id: "ing_chicken", qty: 900, unit: "g", expires_on: null },
    ],
    profiles: [
      { user_id: U1, excluded_ingredient_ids: [], allergen_tags: [], equipment: [], staple_ingredient_ids: ["ing_salt"] },
      { user_id: U2, excluded_ingredient_ids: ["ing_chicken"], allergen_tags: [], equipment: [], staple_ingredient_ids: [] },
    ],
    preferences: [
      { id: "prf_hard", user_id: U1, kind: "hard", active: true, category: "ingredient", value: "cilantro", scope_recipe_id: null },
      { id: "prf_soft", user_id: U1, kind: "soft", active: true, category: "flavor", value: "spicy", scope_recipe_id: null },
      { id: "prf_off", user_id: U1, kind: "hard", active: false, category: "ingredient", value: "egg", scope_recipe_id: null },
      { id: "prf_u2", user_id: U2, kind: "hard", active: true, category: "ingredient", value: "egg", scope_recipe_id: null },
    ],
  };
}

describe("loadPlanningData", () => {
  it("loads curated and own recipes only, with the session user's fridge, profile and hard preferences", async () => {
    seed();
    const d = await loadPlanningData(fakeDb as never, U1);
    expect(d.recipes.map((r) => r.id)).toEqual(["rcp_curated", "rcp_mine"]);
    expect(d.recipes[0]).toEqual({
      id: "rcp_curated", title: "Curated", baseServings: 2, minutes: 20, equipment: ["skillet"],
      ingredients: [{ ingredientId: "ing_chicken", qty: 700, unit: "g", optional: false }],
    });
    expect(d.fridge).toEqual([{ id: "itm_a", ingredientId: "ing_chicken", qty: 200, unit: "g", expiresOn: "2026-10-22" }]);
    expect(d.profile.stapleIngredientIds).toEqual(["ing_salt"]);
    expect(d.hardPreferences.map((p) => p.id)).toEqual(["prf_hard"]);
    expect(d.products.find((p) => p.id === "prd_chicken")?.packageSize).toBe(400);
    expect(d.priceAsOf).toBe("2026-10-20");
  });

  it("uses empty lists when the user has no profile yet", async () => {
    seed();
    tables.profiles = [];
    const d = await loadPlanningData(fakeDb as never, U1);
    expect(d.profile).toEqual({ excludedIngredientIds: [], allergenTags: [], equipment: [], stapleIngredientIds: [] });
  });

  it("fails loud on a query error instead of returning empty data", async () => {
    seed();
    failTable = "products";
    await expect(loadPlanningData(fakeDb as never, U1)).rejects.toThrow(/products.*boom in products/);
  });
});

describe("priceRecipes (join)", () => {
  it("prices a recipe against the user's own fridge: SPEC PLN3 numbers end to end", async () => {
    seed();
    const list = await priceRecipes(U1, ["rcp_curated"], 2);
    expect(list.items).toEqual([expect.objectContaining({ ingredientId: "ing_chicken", needQty: 700, haveQty: 200, packages: 2, costCents: 1000, leftoverQty: 300 })]);
    expect(list.totalCents).toBe(1000);
  });

  it("counts only the session user's own fridge", async () => {
    seed();
    const list = await priceRecipes(U2, ["rcp_curated"], 2);
    expect(list.items[0]).toMatchObject({ haveQty: 900, packages: 0 }); // its own 900 g, not U1's 200 g
  });

  it("a foreign or unknown recipe id is 404", async () => {
    seed();
    await expect(priceRecipes(U1, ["rcp_theirs"], 2)).rejects.toMatchObject({ status: 404 });
    await expect(priceRecipes(U1, ["rcp_nope"], 2)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects non-positive servings", async () => {
    seed();
    await expect(priceRecipes(U1, ["rcp_curated"], 0)).rejects.toMatchObject({ status: 400 });
  });
});
