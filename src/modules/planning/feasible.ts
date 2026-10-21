// Owner: Plan & Shop. Hard-constraint filtering and feasible sets (SPEC PLN2, PLN4). Pure code:
// the planner model may only choose among the sets returned here.
import type { ShoppingList, Unit } from "@spec/contract";
import targets from "@spec/targets.json";
import { buildShoppingList, type ProductInput, type RecipeInput } from "./shopping";

export type CatalogIngredient = { id: string; name: string; allergenTags: string[] };
export type PlanningRecipe = RecipeInput & { title: string; minutes: number; equipment: string[] };
export type FridgeStock = { id: string; ingredientId: string; qty: number; unit: Unit; expiresOn: string | null };
export type HardPreference = { id: string; category: string; value: string; scopeRecipeId: string | null };

export type FeasibleInput = {
  servings: number;
  budgetCents: number;
  maxMinutes: number;
  meals: number;
  mustUseItemIds: string[];
  /** Recipes the user picked (PLN1, step 3): every set includes them unless they break a hard constraint. */
  mustIncludeRecipeIds?: string[];
  recipes: PlanningRecipe[];
  ingredients: CatalogIngredient[];
  products: ProductInput[];
  fridge: FridgeStock[];
  profile: { excludedIngredientIds: string[]; allergenTags: string[]; equipment: string[]; stapleIngredientIds: string[] };
  hardPreferences: HardPreference[];
};

export type FeasibleSet = {
  setId: string;
  recipeIds: string[];
  totalCents: number;
  shopping: ShoppingList;
  usesFridgeItemIds: string[];
};

/** What to relax, named after the input field the user can change. */
export type RelaxHint =
  | "budgetCents" | "maxMinutes" | "meals" | "mustUseItemIds" | "mustIncludeRecipeIds"
  | "excludedIngredients" | "allergens" | "equipment" | "preferences";

/** A picked recipe left out because it breaks a hard constraint, and which one. */
export type DroppedPick = { recipeId: string; because: RelaxHint };

export type FeasibleResult =
  | { ok: true; sets: FeasibleSet[]; droppedPicks: DroppedPick[] }
  | { ok: false; cheapestFeasibleCents: number | null; relax: RelaxHint[]; droppedPicks: DroppedPick[] };

type Filter = { hint: RelaxHint; rejects: (r: PlanningRecipe) => boolean };

function filters(input: FeasibleInput): Filter[] {
  const tags = new Map(input.ingredients.map((i) => [i.id, i.allergenTags]));
  const names = new Map(input.ingredients.map((i) => [i.id, i.name.toLowerCase()]));
  const excluded = new Set(input.profile.excludedIngredientIds);
  const allergens = new Set(input.profile.allergenTags);
  const owned = new Set(input.profile.equipment);
  const required = (r: PlanningRecipe) => r.ingredients.filter((i) => !i.optional);

  // Hard preferences code can check: a recipe-scoped one rules that recipe out; an ingredient one
  // rules out recipes using that ingredient (value is its id or catalog name). Others go to the planner.
  const prefRecipes = new Set(input.hardPreferences.filter((p) => p.scopeRecipeId).map((p) => p.scopeRecipeId!));
  const prefIngredients = new Set(
    input.hardPreferences.filter((p) => !p.scopeRecipeId && p.category === "ingredient").map((p) => p.value.trim().toLowerCase()),
  );

  return [
    { hint: "maxMinutes", rejects: (r) => r.minutes > input.maxMinutes },
    { hint: "excludedIngredients", rejects: (r) => required(r).some((i) => excluded.has(i.ingredientId)) },
    // Allergen tags are matched on every ingredient, optional ones included: never risk one.
    { hint: "allergens", rejects: (r) => r.ingredients.some((i) => (tags.get(i.ingredientId) ?? []).some((t) => allergens.has(t))) },
    // v1 onboarding does not ask for equipment, so an empty list means "not stated", not "owns nothing".
    { hint: "equipment", rejects: (r) => owned.size > 0 && r.equipment.some((e) => !owned.has(e)) },
    {
      hint: "preferences",
      rejects: (r) =>
        prefRecipes.has(r.id) ||
        required(r).some((i) => prefIngredients.has(i.ingredientId) || prefIngredients.has(names.get(i.ingredientId) ?? "")),
    },
  ];
}

function* combinations<T>(items: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield [...acc];
    return;
  }
  for (let i = start; i <= items.length - (k - acc.length); i++) {
    acc.push(items[i]);
    yield* combinations(items, k, i + 1, acc);
    acc.pop();
  }
}

/**
 * Upper bound on the recipe combinations priced per request, so a growing library cannot make
 * planning slow (C(12,5) = 792 today; C(40,5) would be 658,008). Pricing one set is cheap, so this
 * keeps a request well under a second. `ASSUMED:` proposed for spec/targets.json `limits`.
 */
export const MAX_COMBINATIONS = 2000;

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return Math.round(c);
}

/**
 * The recipes worth combining, at most as many as keep C(n, fill) within MAX_COMBINATIONS.
 * Recipes with an unknown price can never be offered, so they go first. When the rest are too many,
 * keep those that use a must-use fridge item, then the cheapest to cook on their own with the
 * user's fridge (shared packages can make a pricier recipe cheaper in a set, so this is a
 * heuristic: the ranking is exact among the recipes kept).
 */
function shortlist(input: FeasibleInput, others: PlanningRecipe[], fill: number, mustUse: FridgeStock[], stock: { ingredientId: string; qty: number; unit: Unit }[]) {
  const alone = new Map(
    others.map((r) => [r, buildShoppingList({
      servings: input.servings, recipes: [r], ingredients: input.ingredients, products: input.products,
      fridge: stock, stapleIngredientIds: input.profile.stapleIngredientIds,
    })]),
  );
  const priced = others.filter((r) => alone.get(r)!.unpricedIngredientIds.length === 0);
  if (choose(priced.length, fill) <= MAX_COMBINATIONS) return priced;

  let keep = fill;
  while (choose(keep + 1, fill) <= MAX_COMBINATIONS && keep + 1 <= priced.length) keep++;
  const usesMustUse = (r: PlanningRecipe) =>
    r.ingredients.some((i) => !i.optional && mustUse.some((f) => f.ingredientId === i.ingredientId && f.unit === i.unit));
  const order = new Map(input.recipes.map((r, i) => [r.id, i]));
  return [...priced]
    .sort((a, b) =>
      Number(usesMustUse(b)) - Number(usesMustUse(a)) ||
      alone.get(a)!.totalCents - alone.get(b)!.totalCents ||
      order.get(a.id)! - order.get(b.id)!)
    .slice(0, keep);
}

/**
 * Every set of `meals` distinct recipes that contains all `picks` and fills the other meals from
 * `candidates`, covers the must-use items, and has every price known; priced.
 */
function pricedSets(input: FeasibleInput, candidates: PlanningRecipe[], picks: PlanningRecipe[]) {
  const mustUse = input.fridge.filter((f) => input.mustUseItemIds.includes(f.id));
  const stock = input.fridge.map(({ ingredientId, qty, unit }) => ({ ingredientId, qty, unit }));
  const order = new Map(input.recipes.map((r, i) => [r.id, i]));
  const fill = input.meals - picks.length;
  const out: Omit<FeasibleSet, "setId">[] = [];
  if (fill < 0) return out;
  const others = shortlist(input, candidates.filter((r) => !picks.includes(r)), fill, mustUse, stock);
  for (const rest of combinations(others, fill)) {
    const combo = [...picks, ...rest].sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    const used = new Set(combo.flatMap((r) => r.ingredients.filter((i) => !i.optional).map((i) => `${i.ingredientId}|${i.unit}`)));
    if (!mustUse.every((f) => used.has(`${f.ingredientId}|${f.unit}`))) continue;
    const shopping = buildShoppingList({
      servings: input.servings,
      recipes: combo,
      ingredients: input.ingredients,
      products: input.products,
      fridge: stock,
      stapleIngredientIds: input.profile.stapleIngredientIds,
    });
    // A set with an unknown price cannot be shown to fit the budget, so it is not offered.
    if (shopping.unpricedIngredientIds.length > 0) continue;
    const usesFridgeItemIds = input.fridge.filter((f) => used.has(`${f.ingredientId}|${f.unit}`)).map((f) => f.id);
    out.push({ recipeIds: combo.map((r) => r.id), totalCents: shopping.totalCents, shopping, usesFridgeItemIds });
  }
  return out;
}

/** Earliest expiry among the fridge items a set uses; sets without one sort last. */
function soonestExpiry(set: Omit<FeasibleSet, "setId">, fridge: FridgeStock[]): string {
  const dates = fridge.filter((f) => set.usesFridgeItemIds.includes(f.id) && f.expiresOn).map((f) => f.expiresOn!);
  return dates.sort()[0] ?? "9999-12-31";
}

/**
 * Feasible sets ranked by code: cheapest first (cost already rewards using fridge stock), then
 * more fridge items used, then the soonest-expiring item used, then recipe ids for a stable order.
 * When none exists, says which constraint to relax and the cheapest total ignoring the budget.
 */
export function findFeasibleSets(input: FeasibleInput): FeasibleResult {
  const fs = filters(input);
  const candidates = input.recipes.filter((r) => !fs.some((f) => f.rejects(r)));

  // Picked recipes stay in every set unless they break a hard constraint; those are dropped and reported.
  const pickIds = [...new Set(input.mustIncludeRecipeIds ?? [])];
  const droppedPicks: DroppedPick[] = [];
  const picks: PlanningRecipe[] = [];
  for (const id of pickIds) {
    const recipe = input.recipes.find((r) => r.id === id);
    if (!recipe) throw new Error(`feasible: picked recipe ${id} was not loaded`);
    const broken = fs.find((f) => f.rejects(recipe));
    if (broken) droppedPicks.push({ recipeId: id, because: broken.hint });
    else picks.push(recipe);
  }

  const priced = pricedSets(input, candidates, picks);
  const fitting = priced.filter((s) => s.totalCents <= input.budgetCents);

  if (fitting.length > 0) {
    fitting.sort(
      (a, b) =>
        a.totalCents - b.totalCents ||
        b.usesFridgeItemIds.length - a.usesFridgeItemIds.length ||
        soonestExpiry(a, input.fridge).localeCompare(soonestExpiry(b, input.fridge)) ||
        a.recipeIds.join().localeCompare(b.recipeIds.join()),
    );
    return { ok: true, sets: fitting.map((s, i) => ({ setId: `set_${i + 1}`, ...s })), droppedPicks };
  }

  const cheapest = priced.length > 0 ? Math.min(...priced.map((s) => s.totalCents)) : null;
  const relax: RelaxHint[] = [];
  if (cheapest !== null) {
    relax.push("budgetCents");
    const fewer = input.meals - 1;
    if (fewer >= targets.limits.mealsPerPlanMin && fewer >= picks.length &&
        pricedSets({ ...input, meals: fewer }, candidates, picks).some((s) => s.totalCents <= input.budgetCents)) {
      relax.push("meals");
    }
    if (picks.length > 0 && pricedSets(input, candidates, []).some((s) => s.totalCents <= input.budgetCents)) relax.push("mustIncludeRecipeIds");
  } else {
    // Which single constraint, if dropped, would leave at least one set (ignoring the budget)?
    for (const f of fs) {
      const loosened = input.recipes.filter((r) => !fs.some((g) => g !== f && g.rejects(r)));
      if (pricedSets(input, loosened, picks).length > 0) relax.push(f.hint);
    }
    if (input.mustUseItemIds.length > 0 && pricedSets({ ...input, mustUseItemIds: [] }, candidates, picks).length > 0) relax.push("mustUseItemIds");
    if (picks.length > 0 && pricedSets(input, candidates, []).length > 0) relax.push("mustIncludeRecipeIds");
    if (candidates.length < input.meals) relax.push("meals");
  }
  return { ok: false, cheapestFeasibleCents: cheapest, relax, droppedPicks };
}
