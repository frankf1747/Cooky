'use client';
import { useState, type FormEvent } from 'react';
import type { FridgeItem, FridgeItemPatch, Location } from '@spec/contract';
import type { z } from 'zod';
import type { IngredientRow, CategoryRow } from '@/modules/fridge/data';
import { field as input, btnSecondary as button } from '@/ui/styles';
import { previewItemExpiry } from '@/modules/fridge/presentation';

type Props = { item: FridgeItem; initialLocation?: Location; ingredients: IngredientRow[]; categories: CategoryRow[]; today: string; busy: boolean; onSave: (patch: Omit<z.infer<typeof FridgeItemPatch>, 'idempotencyKey'>) => void; onCancel: () => void };
export default function ItemEditor({ item, initialLocation, ingredients, categories, today, busy, onSave, onCancel }: Props) {
  const [qty, setQty] = useState(String(item.qty));
  const [location, setLocation] = useState<Location>(initialLocation ?? item.location);
  const [ownDate, setOwnDate] = useState(false);
  const [date, setDate] = useState(item.expiresOn ?? '');
  const preview = previewItemExpiry(item, ingredients, categories, location, ownDate ? date : '', today);
  const changed = Number(qty) !== item.qty || location !== item.location || ownDate;
  function save(e: FormEvent) {
    e.preventDefault();
    if (!changed || preview.requiresDate) return;
    onSave({ expectedQty: item.qty, ...(Number(qty) !== item.qty ? { qty: Number(qty) } : {}), ...(location !== item.location ? { location } : {}), ...(ownDate ? { expiresOn: date } : {}) });
  }
  return <form onSubmit={save} className="mt-4 space-y-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900" aria-label={`Edit ${item.name}`}>
    <h4 className="font-medium">Edit this batch</h4>
    <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Remaining quantity ({item.unit})<input className={`${input} mt-1`} type="number" min="0" step="any" required value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label className="text-sm">Storage location<select className={`${input} mt-1`} value={location} onChange={e => setLocation(e.target.value as Location)}><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="pantry">Pantry</option></select></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ownDate} onChange={e => setOwnDate(e.target.checked)} />Set my own reference date</label>
      {ownDate && <label className="block text-sm">Your reference date<input className={`${input} mt-1`} type="date" required value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} /></label>}
      <div className="text-sm" aria-live="polite"><p>{preview.expiresOn ? `After saving: ${preview.expiresOn}` : 'No reference date available.'}</p>{preview.source && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Typical storage guide only. Source: {preview.source}.</p>}
        {item.expirySource === 'user' && !ownDate && location !== item.location && <p className="mt-1 text-xs">Your existing date will be kept when moving this item.</p>}
        {preview.requiresDate && <p className="mt-1 text-sm text-red-700 dark:text-red-300">No storage guide exists for that location. Set your own reference date to continue.</p>}
        {Number(qty) === 0 && <p className="mt-1 text-sm">Saving zero will mark this batch as used.</p>}
      </div>
      <div className="flex gap-2"><button className={button} type="submit" disabled={!changed || preview.requiresDate}>{busy ? 'Saving…' : 'Confirm changes'}</button><button className={button} type="button" onClick={onCancel}>Cancel edit</button></div>
    </fieldset>
  </form>;
}
