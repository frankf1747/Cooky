import { FridgeItem, type Category, type Location } from '@spec/contract';
import { reader } from '@/platform/db';
import { localToday } from '@/platform/dates';
import { upstream } from '@/platform/errors';

export type IngredientRow = { id: string; name: string; base_unit: 'g' | 'ml' | 'count'; category: Category; shelf_life_days: Partial<Record<Location, number>>; shelf_life_source: string };
export type CategoryRow = { category: Category; shelf_life_days: Partial<Record<Location, number>>; source: string };
export function dbError(context: string, error: { message: string } | null): void {
  if (error) throw upstream('db_error', `${context}: ${error.message}`);
}
export function itemFromRow(row: Record<string, unknown>): FridgeItem {
  return FridgeItem.parse({ id: row.id, kind: row.kind, ingredientId: row.ingredient_id, recipeId: row.recipe_id, name: row.name, category: row.category, qty: Number(row.qty), unit: row.unit, location: row.location, addedOn: row.added_on, expiresOn: row.expires_on, expirySource: row.expiry_source, origin: row.origin, status: row.status });
}
export async function loadItems(userId: string): Promise<FridgeItem[]> {
  const db = await reader();
  const result = await db.from('fridge_items').select('*').eq('user_id', userId).order('expires_on', { ascending: true, nullsFirst: false });
  dbError('Loading fridge', result.error);
  return (result.data ?? []).map(itemFromRow).sort((a, b) => (a.expiresOn ?? '9999-12-31').localeCompare(b.expiresOn ?? '9999-12-31') || a.id.localeCompare(b.id));
}
export async function loadCatalog() {
  const db = await reader();
  const [ingredients, categories] = await Promise.all([
    db.from('ingredients').select('id,name,base_unit,category,shelf_life_days,shelf_life_source').order('name'),
    db.from('category_defaults').select('category,shelf_life_days,source'),
  ]);
  dbError('Loading ingredients', ingredients.error); dbError('Loading expiry references', categories.error);
  return { ingredients: (ingredients.data ?? []) as IngredientRow[], categories: (categories.data ?? []) as CategoryRow[] };
}
export const todayFor = localToday;
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function validDate(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
