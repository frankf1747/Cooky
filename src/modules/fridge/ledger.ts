// All quantity writes go through the existing atomic, idempotent database function.
import { z } from 'zod';
import { BatchEvent, type NewFridgeItem } from '@spec/contract';
import { reader, writer } from '@/platform/db';
import { badRequest, conflict, notFound, upstream } from '@/platform/errors';
import { dbError, validDate } from './data';

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
  const result = await writer(userId).db.rpc('apply_inventory_batch', { p_user: userId, p_batch_key: batchKey, p_events: parsed.data });
  if (result.error) {
    const message = result.error.message;
    if (message.includes('item_not_found:')) throw notFound();
    if (message.includes('insufficient_stock:')) {
      const itemId = message.split('insufficient_stock:')[1]?.split(/\s/)[0];
      const snapshot = itemId ? await db.from('fridge_items').select('qty').eq('user_id', userId).eq('id', itemId).maybeSingle() : null;
      dbError('Reading stock shortfall', snapshot?.error ?? null);
      const requested = -parsed.data.filter(e => e.itemId === itemId).reduce((n, e) => n + e.delta, 0);
      const available = snapshot?.data ? Number(snapshot.data.qty) : null;
      throw conflict('insufficient_stock', { itemId, requested, available, shortBy: available === null ? null : Math.max(0, requested - available), shortfallBasis: 'current_stock_snapshot', message: 'Stock changed or the deduction exceeds the available quantity. Refresh and correct it.' });
    }
    throw upstream('db_error', `Inventory transaction failed: ${message}`);
  }
  return z.object({ createdItemIds: z.array(z.string()) }).parse(result.data);
}
