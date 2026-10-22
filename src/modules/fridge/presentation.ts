// Pure helpers shared by the page preview and server write path. No database or AI calls.
import type { Category, FridgeItem, Location } from '@spec/contract';
import targets from '@spec/targets.json';
import type { CategoryRow, IngredientRow } from './data';
export type InventoryFilters = { search: string; location: string; category: string; date: string };
export function referenceDays(date: string, today: string) { return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000); }
function live(item: FridgeItem) { return item.status === 'active' && item.qty > 0; }
export function filterInventory(items: FridgeItem[], filters: InventoryFilters, today: string) {
  const search = filters.search.trim().toLocaleLowerCase();
  return items.filter(i => {
    if (!live(i) || (filters.location !== 'all' && i.location !== filters.location) || (filters.category !== 'all' && i.category !== filters.category)) return false;
    if (search && !`${i.name} ${i.category ?? ''}`.toLocaleLowerCase().includes(search)) return false;
    const days = i.expiresOn ? referenceDays(i.expiresOn, today) : null;
    return filters.date === 'all' || (filters.date === 'attention' && days !== null && days <= targets.limits.alertLeadDays) || (filters.date === 'past' && days !== null && days < 0) || (filters.date === 'no-date' && days === null);
  });
}
export function summarizeInventory(items: FridgeItem[], today: string) {
  const stock = items.filter(live);
  return { total: stock.length, attention: stock.filter(i => i.expiresOn && referenceDays(i.expiresOn, today) <= targets.limits.alertLeadDays).length, past: stock.filter(i => i.expiresOn && referenceDays(i.expiresOn, today) < 0).length, noDate: stock.filter(i => !i.expiresOn).length };
}
export function previewExpiry(ingredient: IngredientRow | undefined, categories: CategoryRow[], category: Category, location: Location, explicit: string, today: string): { expiresOn: string | null; expirySource: FridgeItem['expirySource']; source: string | null } {
  if (explicit) return { expiresOn: explicit, expirySource: 'user', source: 'Date entered by you' };
  const fallback = categories.find(c => c.category === category);
  const specific = ingredient?.shelf_life_days[location];
  const days = specific ?? fallback?.shelf_life_days[location];
  if (days === undefined || days === null) return { expiresOn: null, expirySource: 'category', source: null };
  const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return { expiresOn: date.toISOString().slice(0, 10), expirySource: specific === undefined || specific === null ? 'category' : 'table', source: specific === undefined || specific === null ? fallback?.source ?? null : ingredient?.shelf_life_source ?? null };
}

/** Recompute only on a real move; user dates are preserved unless explicitly replaced. */
export function previewItemExpiry(item: FridgeItem, ingredients: IngredientRow[], categories: CategoryRow[], location: Location, explicit: string, today: string) {
  const ingredient = ingredients.find(i => i.id === item.ingredientId);
  if (explicit) return { ...previewExpiry(ingredient, categories, item.category ?? 'prepared', location, explicit, today), requiresDate: false };
  if (location === item.location || item.expirySource === 'user') {
    const source = item.expirySource === 'user' ? 'Date entered by you' : item.expirySource === 'table' ? ingredient?.shelf_life_source ?? null : categories.find(c => c.category === item.category)?.source ?? null;
    return { expiresOn: item.expiresOn, expirySource: item.expirySource, source, requiresDate: false };
  }
  const guide = previewExpiry(ingredient, categories, item.category ?? (item.kind === 'dish' ? 'prepared' : 'other'), location, '', today);
  return { ...guide, requiresDate: !guide.expiresOn && Boolean(item.expiresOn) };
}
