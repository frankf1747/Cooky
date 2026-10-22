import { describe, expect, it } from 'vitest';
import type { FridgeItem } from '@spec/contract';
import targets from '@spec/targets.json';
import { filterInventory, summarizeInventory, previewExpiry, previewItemExpiry } from './presentation';
const item = (id: string, date: string | null, extra: Partial<FridgeItem> = {}): FridgeItem => ({ id, kind: 'ingredient', ingredientId: 'ing_egg', recipeId: null, name: 'Eggs', category: 'eggs', qty: 6, unit: 'count', location: 'fridge', addedOn: '2026-10-20', expiresOn: date, expirySource: 'table', origin: 'manual', status: 'active', ...extra });
const stock = [item('itm_past', '2026-10-19'), item('itm_today', '2026-10-20'), item('itm_later', '2026-11-01', { location: 'pantry', name: 'Rice', category: 'pantry' }), item('itm_none', null)];
describe('Fridge inventory controls', () => {
  it('combines normalized search, location, category and date filters', () => {
    expect(filterInventory(stock, { search: '  eGgS ', location: 'fridge', category: 'eggs', date: 'past' }, '2026-10-20').map(i => i.id)).toEqual(['itm_past']);
    expect(filterInventory(stock, { search: 'rice', location: 'fridge', category: 'all', date: 'all' }, '2026-10-20')).toEqual([]);
  });
  it('keeps past references visible in attention counts and excludes inactive stock', () => {
    const result = summarizeInventory([...stock, item('itm_done', '2026-10-20', { status: 'used', qty: 0 })], '2026-10-20');
    expect(result).toEqual({ total: 4, attention: 2, past: 1, noDate: 1 });
    expect(filterInventory(stock, { search: '', location: 'all', category: 'all', date: 'no-date' }, '2026-10-20').map(i => i.id)).toEqual(['itm_none']);
  });
  it('includes the exact configured alert-window boundary', () => {
    const date = new Date('2026-10-20T00:00:00Z'); date.setUTCDate(date.getUTCDate() + targets.limits.alertLeadDays);
    expect(summarizeInventory([item('itm_edge', date.toISOString().slice(0, 10))], '2026-10-20').attention).toBe(1);
  });
});
describe('Honest shelf-life preview', () => {
  const ingredient = { id: 'ing_egg', name: 'Eggs', category: 'eggs' as const, base_unit: 'count' as const, shelf_life_days: { fridge: 21 }, shelf_life_source: 'Catalog source' };
  const categories = [{ category: 'eggs' as const, shelf_life_days: { freezer: 30 }, source: 'Category source' }];
  it('uses ingredient or category guide and handles a month boundary', () => {
    expect(previewExpiry(ingredient, categories, 'eggs', 'fridge', '', '2026-10-20')).toEqual({ expiresOn: '2026-11-10', expirySource: 'table', source: 'Catalog source' });
    expect(previewExpiry(ingredient, categories, 'eggs', 'freezer', '', '2026-10-20')).toEqual({ expiresOn: '2026-11-19', expirySource: 'category', source: 'Category source' });
  });
  it('preserves user dates and never invents a missing guide', () => {
    expect(previewExpiry(ingredient, categories, 'eggs', 'fridge', '2026-10-25', '2026-10-20')).toMatchObject({ expiresOn: '2026-10-25', expirySource: 'user' });
    expect(previewExpiry(undefined, categories, 'other', 'pantry', '', '2026-10-20')).toEqual({ expiresOn: null, expirySource: 'category', source: null });
  });
});

describe('Move preview matches persisted expiry rules', () => {
  const ingredients = [{ id: 'ing_egg', name: 'Eggs', category: 'eggs' as const, base_unit: 'count' as const, shelf_life_days: { fridge: 21, freezer: 30 }, shelf_life_source: 'Fixture guide' }];
  it('recomputes a move but keeps a user-set reference', () => {
    expect(previewItemExpiry(item('itm_one', '2026-10-21'), ingredients, [], 'freezer', '', '2026-10-20')).toMatchObject({ expiresOn: '2026-11-19', expirySource: 'table', requiresDate: false });
    expect(previewItemExpiry(item('itm_one', '2026-10-22', { expirySource: 'user' }), ingredients, [], 'freezer', '', '2026-10-20')).toMatchObject({ expiresOn: '2026-10-22', expirySource: 'user' });
  });
  it('does not extend the date of an item that has not moved', () => {
    expect(previewItemExpiry(item('itm_one', '2026-10-21'), ingredients, [], 'fridge', '', '2026-10-20').expiresOn).toBe('2026-10-21');
  });
  it('requires a reference for moves without a destination guide only if replacing a stored guide', () => {
    expect(previewItemExpiry(item('itm_one', '2026-10-21'), ingredients, [], 'pantry', '', '2026-10-20').requiresDate).toBe(true);
    expect(previewItemExpiry(item('itm_none', null), ingredients, [], 'pantry', '', '2026-10-20').requiresDate).toBe(false);
  });
});
