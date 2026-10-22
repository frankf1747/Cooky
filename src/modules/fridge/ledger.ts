// All quantity writes go through the existing atomic, idempotent database function.
import { z } from 'zod';
import { BatchEvent, FridgeItem, type NewFridgeItem } from '@spec/contract';
import { reader, writer } from '@/platform/db';
import { badRequest, conflict, notFound, upstream } from '@/platform/errors';
import { dbError, todayFor, validDate } from './data';

export async function writeBatch(userId: string, events: BatchEvent[], batchKey: string): Promise<{ createdItemIds: string[] }> {
  const parsed = z.array(BatchEvent).safeParse(events);
  if (!parsed.success || !batchKey.trim()) throw badRequest('invalid_input', 'Invalid inventory batch');
  // Validate ids with the user's read session; the database function rechecks ownership under lock.
  const db = await reader();
  for (const ev of parsed.data) {
    if (!Number.isFinite(ev.delta)) throw badRequest();
    if (ev.itemId === null) {
      const n: NewFridgeItem | undefined = ev.newItem;
      if (!n || n.qty <= 0 || ev.delta !== n.qty || (n.expiresOn && !validDate(n.expiresOn))) throw badRequest('invalid_input', 'A new item needs a positive matching quantity and valid date');
      if (n.kind === 'ingredient') {
        if (!n.ingredientId || n.recipeId) throw badRequest();
        const found = await db.from('ingredients').select('id,base_unit').eq('id', n.ingredientId).maybeSingle();
        dbError('Checking ingredient', found.error); if (!found.data) throw notFound();
        if (found.data.base_unit !== n.unit) throw badRequest('invalid_input', 'Use the ingredient catalog unit');
      } else if (n.kind === 'dish') {
        if (!n.recipeId || n.ingredientId || n.unit !== 'count') throw badRequest();
        const found = await db.from('recipes').select('id').eq('id', n.recipeId).maybeSingle();
        dbError('Checking leftover recipe', found.error); if (!found.data) throw notFound();
      } else if (n.ingredientId || n.recipeId || !n.category || !n.name.trim()) throw badRequest();
    } else {
      if (ev.newItem) throw badRequest();
      const found = await db.from('fridge_items').select('id,qty').eq('user_id', userId).eq('id', ev.itemId).maybeSingle();
      dbError('Checking fridge owner', found.error); if (!found.data) throw notFound();
    }
  }
  const result = await writer(userId).db.rpc('apply_inventory_batch', { p_user: userId, p_batch_key: batchKey, p_events: parsed.data, p_today: await todayFor(userId) });
  if (result.error) {
    const message = result.error.message;
    if (message.includes('item_not_found:')) throw notFound();
    if (message.includes('insufficient_stock:')) {
      const itemId = message.split('insufficient_stock:')[1]?.split(/\s/)[0];
      const detail = rpcDetails(result.error.details, z.object({ available: z.number().nonnegative(), requested: z.number().nonnegative(), shortBy: z.number().nonnegative() }));
      throw conflict('insufficient_stock', { itemId, ...detail });
    }
    throw upstream('db_error', `Inventory transaction failed: ${message}`);
  }
  return z.object({ createdItemIds: z.array(z.string()) }).parse(result.data);
}

// The locked SQL function returns the original mutable fields on replay. Combine
// them with immutable, user-scoped item metadata; never substitute a new read's quantity.
const EditResult = FridgeItem.pick({ qty: true, status: true, location: true, expiresOn: true, expirySource: true }).extend({ itemId: z.string() });
type EditResult = z.infer<typeof EditResult>;
function rpcDetails<T>(details: string | undefined | null, schema: z.ZodType<T>): T {
  try { return schema.parse(JSON.parse(details ?? '')); }
  catch { throw upstream('db_error', 'Inventory transaction returned invalid error details'); }
}
export async function editReplay(userId: string, itemId: string, key: string): Promise<EditResult | null> {
  // inventory_batches is server-only (no client SELECT policy). Always scope this
  // privileged read to the session user and the exact operation key.
  const result = await writer(userId).db.from('inventory_batches').select('result').eq('user_id', userId).eq('batch_key', key).maybeSingle();
  dbError('Checking inventory replay', result.error);
  if (!result.data?.result) return null;
  const cached = EditResult.safeParse(result.data.result);
  if (!cached.success || cached.data.itemId !== itemId) throw badRequest('invalid_input', 'This confirmation key belongs to another action');
  return cached.data;
}
export async function writeEdit(userId: string, args: { p_item: string; p_key: string; p_expected_qty: number; p_qty?: number; p_status?: 'used' | 'tossed'; p_location?: FridgeItem['location']; p_expires_on?: string; p_expiry_source?: FridgeItem['expirySource'] }): Promise<EditResult> {
  const result = await writer(userId).db.rpc('edit_fridge_item', { p_user: userId, ...args });
  if (result.error) {
    const message = result.error.message;
    if (message.startsWith('item_not_found:')) throw notFound();
    if (message.startsWith('stale_quantity:')) throw conflict('stale_quantity', rpcDetails(result.error.details, z.object({ expected: z.number().nonnegative(), actual: z.number().nonnegative() })));
    if (message.startsWith('item_not_active:')) throw conflict('item_not_active', { itemId: args.p_item });
    if (message.startsWith('invalid_edit:') || message.startsWith('invalid_quantity:')) throw badRequest('invalid_input', 'Invalid inventory edit');
    throw upstream('db_error', `Inventory edit failed: ${message}`);
  }
  const parsed = EditResult.parse(result.data);
  if (parsed.itemId !== args.p_item) throw upstream('db_error', 'Inventory transaction returned a different item');
  return parsed;
}
