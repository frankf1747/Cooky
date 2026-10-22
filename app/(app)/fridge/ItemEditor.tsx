'use client';
import { useState, type FormEvent } from 'react';
import type { FridgeItem, FridgeItemPatch, Location } from '@spec/contract';
import type { z } from 'zod';
import type { IngredientRow, CategoryRow } from '@/modules/fridge/data';
import { field as input, btnSecondary as button, btnPrimary, h3, label, panel } from '@/ui/styles';
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
  return <form onSubmit={save} className={`pop-in mt-3 space-y-4 p-4 sm:p-5 ${panel}`} aria-label={`Edit ${item.name}`}>
    <h4 className={h3}>Edit this batch</h4>
    <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Remaining quantity ({item.unit})<input className={input} type="number" min="0" step="any" required value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label className={label}>Storage location<select className={input} value={location} onChange={e => setLocation(e.target.value as Location)}><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="pantry">Pantry</option></select></label>
      </div>
      <label className="flex min-h-11 items-center gap-2.5 text-[15px]"><input className="size-5 accent-accent" type="checkbox" checked={ownDate} onChange={e => setOwnDate(e.target.checked)} />Set my own reference date</label>
      {ownDate && <label className={label}>Your reference date<input className={input} type="date" required value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} /></label>}
      <div className="text-[15px]" aria-live="polite"><p>{preview.expiresOn ? `After saving: ${preview.expiresOn}` : 'No reference date available.'}</p>{preview.source && <p className="mt-1 text-sm text-muted">Typical storage guide only. Source: {preview.source}.</p>}
        {item.expirySource === 'user' && !ownDate && location !== item.location && <p className="mt-1 text-sm text-muted">Your existing date will be kept when moving this item.</p>}
        {preview.requiresDate && <p className="mt-1 text-sm text-danger">No storage guide exists for that location. Set your own reference date to continue.</p>}
        {Number(qty) === 0 && <p className="mt-1 text-sm">Saving zero will mark this batch as used.</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row"><button className={btnPrimary} type="submit" disabled={!changed || preview.requiresDate}>{busy ? 'Saving…' : 'Confirm changes'}</button><button className={button} type="button" onClick={onCancel}>Cancel edit</button></div>
    </fieldset>
  </form>;
}
