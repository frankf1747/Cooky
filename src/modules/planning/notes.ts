// Owner: Plan & Shop. Notes shown with a plan, computed when it is viewed (pure code):
//  - fridge items a meal relies on that are past their typical use-by date (decided 2026-10-20:
//    they still count as on hand, with a warning; never a safety claim either way);
//  - optional recipe ingredients as priced extras, outside the plan total (decided 2026-10-20).
import type { PlanDraft, ShoppingList } from "@spec/contract";
import type { CatalogIngredient, FridgeStock, PlanningRecipe } from "./feasible";
import { buildShoppingList, type ProductInput } from "./shopping";

export type PastUseBy = { itemId: string; name: string; expiresOn: string; recipeIds: string[] };

/** Fridge items the plan's meals use whose typical use-by date is before `today` (YYYY-MM-DD). */
export function pastUseBy(plan: Pick<PlanDraft, "meals">, fridge: FridgeStock[], names: Map<string, string>, today: string): PastUseBy[] {
  const out: PastUseBy[] = [];
  for (const f of fridge) {
    if (!f.expiresOn || f.expiresOn >= today) continue;
    const recipeIds = plan.meals.filter((m) => m.usesFridgeItemIds.includes(f.id)).map((m) => m.recipeId);
    if (recipeIds.length) out.push({ itemId: f.id, name: names.get(f.ingredientId) ?? f.ingredientId, expiresOn: f.expiresOn, recipeIds });
  }
  return out.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}

/**
 * Optional ingredients of the plan's meals, priced like the main list but never added to its total.
 * What the plan already leaves over (fridge stock plus spare package contents) counts as on hand,
 * so an extra the main list already covers costs nothing.
 */
export function optionalExtras(
  plan: Pick<PlanDraft, "meals" | "servings" | "shopping">,
  recipes: PlanningRecipe[],
  ingredients: CatalogIngredient[],
  products: ProductInput[],
  fridge: FridgeStock[],
  stapleIngredientIds: string[],
): ShoppingList {
  const mealIds = new Set(plan.meals.map((m) => m.recipeId));
  const optionalOnly = recipes
    .filter((r) => mealIds.has(r.id))
    .map((r) => ({ ...r, ingredients: r.ingredients.filter((i) => i.optional).map((i) => ({ ...i, optional: false })) }))
    .filter((r) => r.ingredients.length > 0);
  if (optionalOnly.length === 0) return { items: [], totalCents: 0, unpricedIngredientIds: [] };

  // For ingredients on the main list, what is left after it; for the rest, the fridge as it is.
  const onList = new Set(plan.shopping.items.map((i) => `${i.ingredientId}|${i.unit}`));
  const stock = [
    ...plan.shopping.items.map((i) => ({ ingredientId: i.ingredientId, qty: i.leftoverQty, unit: i.unit })),
    ...fridge.filter((f) => !onList.has(`${f.ingredientId}|${f.unit}`)).map(({ ingredientId, qty, unit }) => ({ ingredientId, qty, unit })),
  ];
  return buildShoppingList({ servings: plan.servings, recipes: optionalOnly, ingredients, products, fridge: stock, stapleIngredientIds });
}
