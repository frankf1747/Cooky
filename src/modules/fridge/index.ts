// Owner: Fridge. MVP: ledger, inventory reads, manual add/completion and Cook joins.
import type { z } from 'zod';
import { FridgeItemCreate, FridgeItemPatch, FridgeView, type BatchEvent, type CookNowEntry, type Deduction, type FridgeCheck, FridgeItem, type NewFridgeItem } from '@spec/contract';
import targets from '@spec/targets.json';
import { reader } from '@/platform/db';
import { badRequest, notFound, notImplemented } from '@/platform/errors';
import { addDays, dbError, loadCatalog, loadItems, todayFor, validDate } from './data';
import { previewExpiry, previewItemExpiry } from './presentation';
import { editReplay, writeEdit, writeBatch } from './ledger';

function active(items: FridgeItem[]) { return items.filter(i => i.status === 'active' && i.qty > 0); }
function soon(items: FridgeItem[], today: string) {
  const end = addDays(today, targets.limits.alertLeadDays);
  // Include past-due references so they never silently disappear from the attention list.
  return active(items).filter(i => i.expiresOn && i.expiresOn <= end);
}

async function rankRecipes(userId: string, items: FridgeItem[], today: string): Promise<CookNowEntry[]> {
  const db = await reader();
  const [recipes, ingredients, profile] = await Promise.all([
    db.from('recipes').select('id,title,base_servings'),
    db.from('recipe_ingredients').select('recipe_id,ingredient_id,qty,unit,optional'),
    db.from('profiles').select('household_size,excluded_ingredient_ids,staple_ingredient_ids').eq('user_id', userId).maybeSingle(),
  ]);
  dbError('Loading cook-now recipes', recipes.error); dbError('Loading recipe quantities', ingredients.error); dbError('Loading cooking preferences', profile.error);
  const excluded = new Set<string>(profile.data?.excluded_ingredient_ids ?? []);
  const staples = new Set<string>(profile.data?.staple_ingredient_ids ?? []);
  const stock = active(items).filter(i => i.kind === 'ingredient');
  const expiring = new Set(soon(items, today).map(i => i.id));
  return (recipes.data ?? []).flatMap(recipe => {
    const required = (ingredients.data ?? []).filter(i => i.recipe_id === recipe.id && !i.optional);
    if (!required.length || required.some(i => excluded.has(i.ingredient_id))) return [];
    let satisfied = 0;
    const missing: string[] = []; const uses = new Set<string>();
    for (const req of required) {
      const matches = stock.filter(i => i.ingredientId === req.ingredient_id && i.unit === req.unit);
      const amount = matches.reduce((n, i) => n + i.qty, 0);
      const needed = Number(req.qty) * (profile.data?.household_size ?? recipe.base_servings) / recipe.base_servings;
      if (amount >= needed || staples.has(req.ingredient_id)) satisfied++;
      else missing.push(req.ingredient_id);
      for (const item of matches) if (expiring.has(item.id)) uses.add(item.id);
    }
    return [{ recipeId: recipe.id, title: recipe.title, coverage: satisfied / required.length, usesExpiringItemIds: [...uses], missingIngredientIds: missing }];
  }).sort((a, b) => (b.coverage + b.usesExpiringItemIds.length / (b.usesExpiringItemIds.length + 1)) - (a.coverage + a.usesExpiringItemIds.length / (a.usesExpiringItemIds.length + 1)) || a.recipeId.localeCompare(b.recipeId));
}

export async function view(userId: string): Promise<FridgeView> {
  const [items, today] = await Promise.all([loadItems(userId), todayFor(userId)]);
  return FridgeView.parse({ items: active(items), expiringSoon: soon(items, today).map(i => i.id), cookNow: await rankRecipes(userId, items, today) });
}
export async function applyBatch(userId: string, events: BatchEvent[], batchKey: string): Promise<{ createdItemIds: string[]; fridge: FridgeView }> {
  const result = await writeBatch(userId, events, batchKey);
  return { createdItemIds: result.createdItemIds, fridge: await view(userId) };
}
export async function addItem(userId: string, raw: z.infer<typeof FridgeItemCreate>): Promise<{ itemId: string }> {
  const parsed = FridgeItemCreate.safeParse(raw); if (!parsed.success) throw badRequest();
  const input = parsed.data;
  if (input.expiresOn && !validDate(input.expiresOn)) throw badRequest('invalid_input', 'Invalid calendar date');
  const [{ ingredients, categories }, today] = await Promise.all([loadCatalog(), todayFor(userId)]);
  const ingredient = input.ingredientId ? ingredients.find(i => i.id === input.ingredientId) : undefined;
  if (input.ingredientId && !ingredient) throw notFound();
  if (ingredient && ingredient.base_unit !== input.unit) throw badRequest('invalid_input', 'Use the ingredient catalog unit');
  const name = ingredient?.name ?? input.name?.trim(); const category = ingredient?.category ?? input.category;
  if (!name || !category) throw badRequest('invalid_input', 'Choose a catalog ingredient or enter a name and category');
  const preview = previewExpiry(ingredient, categories, category, input.location, input.expiresOn ?? '', today);
  const item: NewFridgeItem = { kind: ingredient ? 'ingredient' : 'generic', ingredientId: ingredient?.id ?? null, recipeId: null, name, category, qty: input.qty, unit: input.unit, location: input.location, expiresOn: preview.expiresOn, expirySource: preview.expirySource, origin: 'manual' };
  const result = await writeBatch(userId, [{ itemId: null, delta: item.qty, reason: 'purchase', newItem: item }], `man:${input.idempotencyKey}`);
  const itemId = result.createdItemIds[0]; if (!itemId) throw new Error('Inventory transaction returned no item id');
  return { itemId };
}
export async function updateItem(userId: string, itemId: string, raw: z.infer<typeof FridgeItemPatch>): Promise<FridgeItem> {
  const parsed = FridgeItemPatch.safeParse(raw); if (!parsed.success) throw badRequest();
  const input = parsed.data;
  const current = (await loadItems(userId)).find(i => i.id === itemId); if (!current) throw notFound();
  if (input.expectedQty === undefined) throw badRequest('invalid_input', 'Refresh the fridge and include the quantity you saw');
  if (input.qty !== undefined && input.status !== undefined) throw badRequest('invalid_input', 'Change quantity or mark finished, not both');
  if (input.qty === undefined && input.status === undefined && input.location === undefined && input.expiresOn === undefined) throw badRequest('invalid_input', 'Choose a change to save');
  if (input.expiresOn && !validDate(input.expiresOn)) throw badRequest('invalid_input', 'Invalid calendar date');
  const key = `edt:${input.idempotencyKey}`;
  const replayed = await editReplay(userId, itemId, key);
  if (replayed) return FridgeItem.parse({ ...current, ...replayed, id: itemId });
  let expiry: { p_expires_on?: string; p_expiry_source?: FridgeItem['expirySource'] } = {};
  if (input.expiresOn) expiry = { p_expires_on: input.expiresOn, p_expiry_source: 'user' };
  else if (input.location && input.location !== current.location && current.expirySource !== 'user') {
    const [{ ingredients, categories }, today] = await Promise.all([loadCatalog(), todayFor(userId)]);
    const guide = previewItemExpiry(current, ingredients, categories, input.location, '', today);
    if (guide.expiresOn) expiry = { p_expires_on: guide.expiresOn, p_expiry_source: guide.expirySource };
    else if (current.expiresOn) throw badRequest('invalid_input', 'No guide exists for this location. Enter your own reference date before moving it.');
  }
  const edited = await writeEdit(userId, { p_item: itemId, p_key: key, p_expected_qty: input.expectedQty, ...(input.qty !== undefined ? { p_qty: input.qty } : {}), ...(input.status ? { p_status: input.status } : {}), ...(input.location ? { p_location: input.location } : {}), ...expiry });
  return FridgeItem.parse({ ...current, ...edited, id: itemId });
}
export async function expiringSoon(userId: string): Promise<FridgeItem[]> { return soon(await loadItems(userId), await todayFor(userId)); }
export async function cookNow(userId: string): Promise<CookNowEntry[]> { return rankRecipes(userId, await loadItems(userId), await todayFor(userId)); }
export async function proposeDeductions(userId: string, recipeId: string, servings: number): Promise<Deduction[]> {
  if (!Number.isInteger(servings) || servings < targets.limits.servingsMin || servings > targets.limits.servingsMax) throw badRequest();
  const db = await reader();
  const recipe = await db.from('recipes').select('id,base_servings').eq('id', recipeId).maybeSingle();
  dbError('Loading deduction recipe', recipe.error); if (!recipe.data) throw notFound();
  const reqs = await db.from('recipe_ingredients').select('*').eq('recipe_id', recipeId); dbError('Loading required ingredients', reqs.error);
  const items = active(await loadItems(userId)); const deductions: Deduction[] = [];
  for (const req of reqs.data ?? []) {
    if (req.optional) continue;
    let remaining = Number(req.qty) * servings / recipe.data.base_servings;
    const matches = items.filter(i => i.kind === 'ingredient' && i.ingredientId === req.ingredient_id && i.unit === req.unit);
    const start = deductions.length;
    for (const item of matches) {
      if (remaining <= 0) break;
      const qty = Math.min(item.qty, remaining); remaining -= qty;
      deductions.push({ itemId: item.id, ingredientId: req.ingredient_id, qty, unit: item.unit, shortBy: null });
    }
    if (remaining > 0 && deductions.length > start) deductions[deductions.length - 1].shortBy = remaining;
    // No stock has no itemId to represent a deduction: caller compares requirements to this list.
  }
  return deductions;
}
// v2 intentionally remains explicit.
export async function check(userId: string, input: z.infer<typeof FridgeCheck>): Promise<FridgeView> { void userId; void input; throw notImplemented('fridge.check (v2)'); }
export async function stats(userId: string): Promise<{ tossedCents30d: number; tossedItems30d: number; cookedMeals30d: number }> { void userId; throw notImplemented('fridge.stats (v2)'); }
