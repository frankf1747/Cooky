// Owner: Plan & Shop. Shopping math (SPEC PLN3). Pure code, no database and no model:
// callers load recipes, products, fridge stock and staples and pass them in.
import type { ShoppingItem, ShoppingList, Unit } from "@spec/contract";
import { sumCents } from "@/platform/money";

export type RecipeIngredientInput = { ingredientId: string; qty: number; unit: Unit; optional?: boolean };
export type RecipeInput = { id: string; baseServings: number; ingredients: RecipeIngredientInput[] };
export type ProductInput = { id: string; ingredientId: string; packageSize: number; unit: Unit; priceCents: number };
export type StockInput = { ingredientId: string; qty: number; unit: Unit };

export type ShoppingInput = {
  servings: number;
  recipes: RecipeInput[];
  ingredients: { id: string; name: string }[];
  products: ProductInput[];
  /** Confirmed, active fridge stock; generic items (no ingredient id) are excluded by the caller. */
  fridge: StockInput[];
  /** Ingredients the user always has (profile staples): counted as on hand, never bought. */
  stapleIngredientIds: string[];
};

/** Quantities are kept to 0.01 of a base unit, matching toBase(). */
const round = (n: number) => Math.round(n * 100) / 100;

/** Cheapest product (by total cost for this buy) in the same unit; ties go to less leftover, then id. */
function choosePackage(buyQty: number, products: ProductInput[]) {
  let best: { product: ProductInput; packages: number; costCents: number; boughtQty: number } | null = null;
  for (const product of products) {
    // Round the ratio first so floating-point noise (0.30000000000000004 / 0.3) cannot add a package.
    const packages = Math.ceil(round((buyQty / product.packageSize) * 1e6) / 1e6);
    const costCents = packages * product.priceCents;
    const boughtQty = round(packages * product.packageSize);
    if (
      !best ||
      costCents < best.costCents ||
      (costCents === best.costCents && boughtQty < best.boughtQty) ||
      (costCents === best.costCents && boughtQty === best.boughtQty && product.id < best.product.id)
    ) {
      best = { product, packages, costCents, boughtQty };
    }
  }
  return best;
}

export function buildShoppingList(input: ShoppingInput): ShoppingList {
  const names = new Map(input.ingredients.map((i) => [i.id, i.name]));
  const staples = new Set(input.stapleIngredientIds);

  // Scale and merge by (ingredient id, unit), keeping first-seen order.
  const needs = new Map<string, { ingredientId: string; unit: Unit; qty: number; recipeIds: string[] }>();
  for (const recipe of input.recipes) {
    const scale = input.servings / recipe.baseServings;
    for (const ri of recipe.ingredients) {
      if (ri.optional) continue;
      if (!names.has(ri.ingredientId)) {
        throw new Error(`shopping: ingredient ${ri.ingredientId} in ${recipe.id} is not in the catalog`);
      }
      const key = `${ri.ingredientId}|${ri.unit}`;
      const need = needs.get(key) ?? { ingredientId: ri.ingredientId, unit: ri.unit, qty: 0, recipeIds: [] };
      need.qty += ri.qty * scale;
      if (!need.recipeIds.includes(recipe.id)) need.recipeIds.push(recipe.id);
      needs.set(key, need);
    }
  }

  const items: ShoppingItem[] = [];
  const unpriced: string[] = [];

  for (const need of needs.values()) {
    const needQty = round(need.qty);
    const stock = input.fridge
      .filter((s) => s.ingredientId === need.ingredientId && s.unit === need.unit)
      .reduce((sum, s) => sum + s.qty, 0);
    const haveQty = staples.has(need.ingredientId) ? needQty : round(stock);
    const buyQty = round(Math.max(0, needQty - haveQty));

    const base = { ingredientId: need.ingredientId, name: names.get(need.ingredientId)!, needQty, unit: need.unit, haveQty, buyQty, forRecipeIds: need.recipeIds };

    if (buyQty === 0) {
      items.push({ ...base, packages: 0, packageSize: null, packageCents: null, costCents: 0, leftoverQty: round(haveQty - needQty) });
      continue;
    }

    const pick = choosePackage(buyQty, input.products.filter((p) => p.ingredientId === need.ingredientId && p.unit === need.unit));
    if (!pick) {
      // Unknown price: null, listed, never summed as zero. Assume exactly the shortfall is bought.
      unpriced.push(need.ingredientId);
      items.push({ ...base, packages: 0, packageSize: null, packageCents: null, costCents: null, leftoverQty: 0 });
      continue;
    }

    items.push({
      ...base,
      packages: pick.packages,
      packageSize: pick.product.packageSize,
      packageCents: pick.product.priceCents,
      costCents: pick.costCents,
      leftoverQty: round(haveQty + pick.boughtQty - needQty),
    });
  }

  return { items, totalCents: sumCents(items.map((i) => i.costCents)).total, unpricedIngredientIds: unpriced };
}
