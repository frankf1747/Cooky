import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FridgeView } from '@spec/contract';

const state = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, calls: [] as unknown[], batches: new Map<string, unknown>(), fail: false }));
vi.mock('@/platform/db', () => {
  function from(table: string) {
    const filters: [string, unknown][] = [];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query,
      async maybeSingle() { const r = await query; return { data: r.data[0] ?? null, error: r.error }; },
      then(resolve: (value: { data: Record<string, unknown>[]; error: { message: string } | null }) => unknown) {
        return Promise.resolve({ data: (state.tables[table] ?? []).filter(row => filters.every(([key, value]) => row[key] === value)), error: state.fail ? { message: 'database offline' } : null }).then(resolve);
      },
    };
    return query;
  }
  return {
    reader: async () => ({ from }),
    writer: (userId: string) => ({ userId, db: { async rpc(name: string, args: { p_user: string; p_batch_key: string; p_events: { itemId: string | null; delta: number; reason: string; newItem?: Record<string, unknown> }[] }) {
      state.calls.push({ name, args });
      if (state.fail) return { data: null, error: { message: 'database offline' } };
      const key = args.p_user + args.p_batch_key;
      if (state.batches.has(key)) return { data: state.batches.get(key), error: null };
      const created: string[] = [];
      // The real atomicity is tested by Platform's SQL tests; this fake exercises module wiring.
      for (const event of args.p_events) {
        if (event.itemId) {
          const row = state.tables.fridge_items.find(r => r.id === event.itemId && r.user_id === args.p_user);
          if (!row) return { data: null, error: { message: 'item_not_found:' + event.itemId } };
          if (Number(row.qty) + event.delta < 0) return { data: null, error: { message: 'insufficient_stock:' + event.itemId } };
        }
      }
      for (const event of args.p_events) {
        if (!event.itemId) {
          const n = event.newItem!; const id = 'itm_created_' + state.tables.fridge_items.length; created.push(id);
          state.tables.fridge_items.push({ id, user_id: args.p_user, kind: n.kind, ingredient_id: n.ingredientId, recipe_id: n.recipeId, name: n.name, category: n.category, qty: n.qty, unit: n.unit, location: n.location, added_on: '2026-10-20', expires_on: n.expiresOn, expiry_source: n.expirySource, origin: n.origin, status: 'active' });
        } else {
          const row = state.tables.fridge_items.find(r => r.id === event.itemId)!;
          row.qty = Number(row.qty) + event.delta;
          if (row.qty === 0) row.status = event.reason === 'toss' ? 'tossed' : 'used';
        }
      }
      const data = { createdItemIds: created, events: args.p_events.length };
      state.batches.set(key, data); return { data, error: null };
    } } }),
  };
});
const fridge = await import('./index');
const row = (id = 'itm_one', user = 'u1') => ({ id, user_id: user, kind: 'ingredient', ingredient_id: 'ing_egg', recipe_id: null, name: 'Eggs', category: 'eggs', qty: 6, unit: 'count', location: 'fridge', added_on: '2026-10-20', expires_on: '2026-10-21', expiry_source: 'table', origin: 'manual', status: 'active' });
afterEach(() => vi.useRealTimers());
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T20:00:00Z"));
  state.tables = { fridge_items: [], inventory_batches: [], profiles: [{ user_id: 'u1', timezone: 'America/Los_Angeles' }], ingredients: [{ id: 'ing_egg', name: 'Eggs', base_unit: 'count', category: 'eggs', shelf_life_days: { fridge: 21 }, shelf_life_source: 'Catalog fixture' }], category_defaults: [{ category: 'eggs', shelf_life_days: { fridge: 21 }, source: 'Category fixture' }], recipes: [], recipe_ingredients: [] };
  state.calls = []; state.batches.clear(); state.fail = false;
});
describe('Fridge MVP (FRG1-FRG5)', () => {
  it('returns an exact contract view and filters other users', async () => {
    state.tables.fridge_items = [row(), row('itm_foreign', 'u2')];
    const result = await fridge.view('u1'); expect(FridgeView.parse(result).items.map(i => i.id)).toEqual(['itm_one']);
  });
  it('adds a catalog item with its canonical name and retries without duplicating it', async () => {
    const input = { ingredientId: 'ing_egg', qty: 2, unit: 'count' as const, location: 'fridge' as const, idempotencyKey: 'manual-key-123' };
    expect(await fridge.addItem('u1', input)).toEqual({ itemId: 'itm_created_0' });
    await fridge.addItem('u1', input); expect(state.tables.fridge_items).toHaveLength(1);
    expect(state.tables.fridge_items[0]).toMatchObject({ name: 'Eggs', ingredient_id: 'ing_egg', qty: 2 });
  });
  it('rejects wrong catalog units and unknown ingredient IDs', async () => {
    const input = { ingredientId: 'ing_egg', qty: 2, unit: 'g' as const, location: 'fridge' as const, idempotencyKey: 'manual-key-123' };
    await expect(fridge.addItem('u1', input)).rejects.toMatchObject({ status: 400 });
    await expect(fridge.addItem('u1', { ...input, ingredientId: 'ing_missing' })).rejects.toMatchObject({ status: 404 });
    expect(state.calls).toHaveLength(0);
  });
  it('updates quantity through the ledger and supports used and tossed', async () => {
    state.tables.fridge_items = [row()];
    expect((await fridge.updateItem('u1', 'itm_one', { status: 'used', idempotencyKey: 'used-key-123' })).qty).toBe(0);
    state.tables.fridge_items = [row()];
    expect((await fridge.updateItem('u1', 'itm_one', { status: 'tossed', idempotencyKey: 'toss-key-123' })).status).toBe('tossed');
    expect(state.calls).toHaveLength(2);
  });
  it('hides foreign items and rejects insufficient stock', async () => {
    state.tables.fridge_items = [row('itm_other', 'u2'), row()];
    await expect(fridge.updateItem('u1', 'itm_other', { qty: 1, idempotencyKey: 'edit-key-123' })).rejects.toMatchObject({ status: 404 });
    await expect(fridge.applyBatch('u1', [{ itemId: 'itm_one', delta: -7, reason: 'cook' }], 'cke_test')).rejects.toMatchObject({ status: 409, code: 'insufficient_stock', extra: { shortBy: 1 } });
    expect(state.tables.fridge_items[1].qty).toBe(6);
  });
  it('rejects malformed new events before any write', async () => {
    await expect(fridge.applyBatch('u1', [{ itemId: null, delta: 1, reason: 'purchase' }], 'rct_test')).rejects.toMatchObject({ status: 400 });
    expect(state.calls).toHaveLength(0);
  });
  it('does not disguise database errors as an empty fridge', async () => {
    state.fail = true; await expect(fridge.view('u1')).rejects.toThrow('database offline');
  });
});

describe('Fridge dates, recipe matching and deductions', () => {
  it('uses category dates for generic food, and preserves explicit user dates', async () => {
    await fridge.addItem('u1', { ingredientId: null, name: 'Unmatched eggs', category: 'eggs', qty: 3, unit: 'count', location: 'fridge', idempotencyKey: 'generic-key-123' });
    expect(state.tables.fridge_items[0]).toMatchObject({ kind: 'generic', ingredient_id: null, expires_on: '2026-11-10', expiry_source: 'category' });
    await fridge.addItem('u1', { ingredientId: 'ing_egg', qty: 1, unit: 'count', location: 'fridge', expiresOn: '2026-10-22', idempotencyKey: 'custom-date-123' });
    expect(state.tables.fridge_items[1]).toMatchObject({ expires_on: '2026-10-22', expiry_source: 'user' });
    await expect(fridge.addItem('u1', { ingredientId: 'ing_egg', qty: 1, unit: 'count', location: 'fridge', expiresOn: '2026-02-30', idempotencyKey: 'invalid-date-123' })).rejects.toMatchObject({ status: 400 });
  });
  it('sorts dated stock first and omits used/tossed items from alerts', async () => {
    state.tables.fridge_items = [{ ...row('itm_later'), expires_on: '2026-10-30' }, { ...row('itm_none'), expires_on: null }, { ...row('itm_used'), qty: 0, status: 'used' }, row('itm_soon')];
    const result = await fridge.view('u1');
    expect(result.items.map(i => i.id)).toEqual(['itm_soon', 'itm_later', 'itm_none']);
    expect((await fridge.expiringSoon('u1')).map(i => i.id)).toEqual(['itm_soon']);
  });
  it('ranks recipes using owned canonical stock, optional ingredients and exclusions', async () => {
    state.tables.fridge_items = [row(), { ...row('itm_generic'), kind: 'generic', ingredient_id: null, qty: 100 }, { ...row('itm_other', 'u2'), ingredient_id: 'ing_rice' }];
    state.tables.profiles[0] = { ...state.tables.profiles[0], household_size: 2, excluded_ingredient_ids: ['ing_peanut'] };
    state.tables.recipes = [{ id: 'rcp_eggs', title: 'Eggs', base_servings: 2 }, { id: 'rcp_rice', title: 'Rice', base_servings: 2 }, { id: 'rcp_unsafe', title: 'Excluded', base_servings: 2 }];
    state.tables.recipe_ingredients = [{ recipe_id: 'rcp_eggs', ingredient_id: 'ing_egg', qty: 2, unit: 'count', optional: false }, { recipe_id: 'rcp_eggs', ingredient_id: 'ing_garnish', qty: 1, unit: 'g', optional: true }, { recipe_id: 'rcp_rice', ingredient_id: 'ing_rice', qty: 1, unit: 'g', optional: false }, { recipe_id: 'rcp_unsafe', ingredient_id: 'ing_peanut', qty: 1, unit: 'g', optional: false }];
    const ranked = await fridge.cookNow('u1');
    expect(ranked).toEqual([{ recipeId: 'rcp_eggs', title: 'Eggs', coverage: 1, usesExpiringItemIds: ['itm_one'], missingIngredientIds: [] }, { recipeId: 'rcp_rice', title: 'Rice', coverage: 0, usesExpiringItemIds: [], missingIngredientIds: ['ing_rice'] }]);
  });
  it('proposes earliest-expiry deductions with shortfalls without mutating stock', async () => {
    state.tables.fridge_items = [{ ...row('itm_later'), qty: 2, expires_on: '2026-10-25' }, { ...row('itm_first'), qty: 1 }];
    state.tables.recipes = [{ id: 'rcp_eggs', base_servings: 2 }];
    state.tables.recipe_ingredients = [{ recipe_id: 'rcp_eggs', ingredient_id: 'ing_egg', qty: 4, unit: 'count', optional: false }];
    expect(await fridge.proposeDeductions('u1', 'rcp_eggs', 2)).toEqual([{ itemId: 'itm_first', ingredientId: 'ing_egg', qty: 1, unit: 'count', shortBy: null }, { itemId: 'itm_later', ingredientId: 'ing_egg', qty: 2, unit: 'count', shortBy: 1 }]);
    expect(state.calls).toHaveLength(0);
    await expect(fridge.proposeDeductions('u1', 'rcp_eggs', 0)).rejects.toMatchObject({ status: 400 });
    await expect(fridge.proposeDeductions('u1', 'rcp_missing', 2)).rejects.toMatchObject({ status: 404 });
  });
  it('does not repeat completion or allow unsafe absolute quantity edits', async () => {
    state.tables.fridge_items = [row()];
    await expect(fridge.updateItem('u1', 'itm_one', { qty: 4, idempotencyKey: 'edit-key-123' })).rejects.toMatchObject({ status: 501 });
    await fridge.updateItem('u1', 'itm_one', { status: 'used', idempotencyKey: 'used-key-123' });
    await fridge.updateItem('u1', 'itm_one', { status: 'used', idempotencyKey: 'used-key-123' });
    expect(state.tables.fridge_items[0].qty).toBe(0);
    expect(state.calls).toHaveLength(1);
  });
  it('leaves unsupported metadata and v2 operations explicit with no writes', async () => {
    state.tables.fridge_items = [row()];
    await expect(fridge.updateItem('u1', 'itm_one', { location: 'freezer', idempotencyKey: 'move-key-123' })).rejects.toMatchObject({ status: 501 });
    await expect(fridge.stats('u1')).rejects.toMatchObject({ status: 501 });
    expect(state.calls).toHaveLength(0);
  });
});
