// Owner: Plan & Shop. Loads what the shopping math and feasible sets need, through the user's
// session (RLS applies) and filtered by the session user as the first wall (SPEC §9).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Unit } from "@spec/contract";
import type { CatalogIngredient, FeasibleInput, FridgeStock, HardPreference, PlanningRecipe } from "./feasible";
import type { ProductInput } from "./shopping";

export type PlanningData = {
  recipes: PlanningRecipe[];
  ingredients: CatalogIngredient[];
  products: ProductInput[];
  fridge: FridgeStock[];
  profile: FeasibleInput["profile"];
  hardPreferences: HardPreference[];
  /** Confirmed soft preferences: context for the planner, never filters. */
  softPreferences: HardPreference[];
  /** The user's timezone, for "today" when deciding what expires soon. */
  timezone: string;
  /** Latest price date among the products loaded, or null when none. */
  priceAsOf: string | null;
};

/** Fail loud: a query error is thrown with its message, never replaced by empty data. */
function rows<T>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`planning: loading ${what} failed: ${res.error.message}`);
  return res.data ?? [];
}

type RecipeRow = { id: string; title: string; base_servings: number; minutes: number; equipment: string[] };
type RecipeIngredientRow = { recipe_id: string; ingredient_id: string; qty: number | string; unit: Unit; optional: boolean };
type IngredientRow = { id: string; name: string; allergen_tags: string[] };
type ProductRow = { id: string; ingredient_id: string; package_size: number | string; unit: Unit; price_cents: number; price_date: string };
type FridgeRow = { id: string; ingredient_id: string; qty: number | string; unit: Unit; expires_on: string | null };
type ProfileRow = { excluded_ingredient_ids: string[]; allergen_tags: string[]; equipment: string[]; staple_ingredient_ids: string[]; timezone: string };
type PreferenceRow = { id: string; kind: "hard" | "soft"; category: string; value: string; scope_recipe_id: string | null };

/**
 * Recipes visible to the user (curated or their own); only `recipeIds` when given.
 * Unknown ids are simply absent from the result: callers decide whether that is a 404.
 */
export async function loadPlanningData(db: SupabaseClient, userId: string, recipeIds?: string[]): Promise<PlanningData> {
  let recipeQuery = db
    .from("recipes")
    .select("id, title, base_servings, minutes, equipment")
    .or(`owner_id.is.null,owner_id.eq.${userId}`);
  if (recipeIds) recipeQuery = recipeQuery.in("id", recipeIds);

  const [recipeRes, fridgeRes, profileRes, prefRes] = await Promise.all([
    recipeQuery,
    db.from("fridge_items").select("id, ingredient_id, qty, unit, expires_on")
      .eq("user_id", userId).eq("status", "active").eq("kind", "ingredient"),
    db.from("profiles").select("excluded_ingredient_ids, allergen_tags, equipment, staple_ingredient_ids, timezone")
      .eq("user_id", userId).maybeSingle(),
    db.from("preferences").select("id, kind, category, value, scope_recipe_id")
      .eq("user_id", userId).eq("active", true),
  ]);
  const recipeRows = rows<RecipeRow>(recipeRes, "recipes");
  const fridgeRows = rows<FridgeRow>(fridgeRes, "fridge items");
  if (profileRes.error) throw new Error(`planning: loading profile failed: ${profileRes.error.message}`);
  const profile = profileRes.data as ProfileRow | null;
  const prefRows = rows<PreferenceRow>(prefRes, "preferences");

  const ids = recipeRows.map((r) => r.id);
  const riRows = ids.length
    ? rows<RecipeIngredientRow>(await db.from("recipe_ingredients").select("recipe_id, ingredient_id, qty, unit, optional").in("recipe_id", ids), "recipe ingredients")
    : [];

  const ingredientIds = [...new Set([...riRows.map((r) => r.ingredient_id), ...fridgeRows.map((f) => f.ingredient_id)])];
  const [ingRes, prodRes] = ingredientIds.length
    ? await Promise.all([
        db.from("ingredients").select("id, name, allergen_tags").in("id", ingredientIds),
        db.from("products").select("id, ingredient_id, package_size, unit, price_cents, price_date").in("ingredient_id", ingredientIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const ingRows = rows<IngredientRow>(ingRes, "ingredients");
  const prodRows = rows<ProductRow>(prodRes, "products");

  const recipes: PlanningRecipe[] = recipeRows.map((r) => ({
    id: r.id,
    title: r.title,
    baseServings: Number(r.base_servings),
    minutes: Number(r.minutes),
    equipment: r.equipment ?? [],
    ingredients: riRows
      .filter((ri) => ri.recipe_id === r.id)
      .map((ri) => ({ ingredientId: ri.ingredient_id, qty: Number(ri.qty), unit: ri.unit, optional: ri.optional })),
  }));

  return {
    recipes,
    ingredients: ingRows.map((i) => ({ id: i.id, name: i.name, allergenTags: i.allergen_tags ?? [] })),
    products: prodRows.map((p) => ({ id: p.id, ingredientId: p.ingredient_id, packageSize: Number(p.package_size), unit: p.unit, priceCents: p.price_cents })),
    fridge: fridgeRows.map((f) => ({ id: f.id, ingredientId: f.ingredient_id, qty: Number(f.qty), unit: f.unit, expiresOn: f.expires_on })),
    // No profile row yet (before onboarding): the table's own defaults, which are empty lists.
    profile: {
      excludedIngredientIds: profile?.excluded_ingredient_ids ?? [],
      allergenTags: profile?.allergen_tags ?? [],
      equipment: profile?.equipment ?? [],
      stapleIngredientIds: profile?.staple_ingredient_ids ?? [],
    },
    hardPreferences: prefRows.filter((p) => p.kind === "hard").map((p) => ({ id: p.id, category: p.category, value: p.value, scopeRecipeId: p.scope_recipe_id })),
    softPreferences: prefRows
      .filter((p) => p.kind === "soft")
      .map((p) => ({ id: p.id, category: p.category, value: p.value, scopeRecipeId: p.scope_recipe_id })),
    timezone: profile?.timezone ?? "America/Los_Angeles",
    priceAsOf: prodRows.map((p) => p.price_date).sort().at(-1) ?? null,
  };
}
