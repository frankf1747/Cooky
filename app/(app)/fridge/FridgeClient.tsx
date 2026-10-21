'use client';

import Link from 'next/link';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Category, FridgeView, type FridgeItem, type Location } from '@spec/contract';
import { filterInventory, summarizeInventory, previewExpiry, referenceDays } from '@/modules/fridge/presentation';
import type { IngredientRow, CategoryRow } from '@/modules/fridge/data';

type Props = { initial: FridgeView; ingredients: IngredientRow[]; categories: CategoryRow[]; today: string };
const inputClass = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:outline-2 focus:outline-emerald-700';
const buttonClass = 'rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100 disabled:cursor-wait disabled:opacity-50';
const locations = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry' };
async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${body.error ?? 'Request failed'}${body.message ? `: ${body.message}` : ''}${body.code ? ` (${body.code})` : ''}${body.requestId ? ` · ${body.requestId}` : ''}`);
  return body;
}


export default function FridgeClient({ initial, ingredients, categories, today }: Props) {
  const [data, setData] = useState<FridgeView | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const operation = useRef<{ body: string; key: string } | null>(null);
  const [form, setForm] = useState({ ingredientId: ingredients[0]?.id ?? '', name: '', category: 'other', qty: '', unit: ingredients[0]?.base_unit ?? 'count', location: 'fridge', expiresOn: '' });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [confirmation, setConfirmation] = useState<{ itemId: string; status: 'used' | 'tossed' } | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(FridgeView.parse(await api('/api/fridge'))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load your fridge'); }
    finally { setLoading(false); }
  }, []);

  async function mutate(path: string, method: string, payload: Record<string, unknown>, message: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    const body = JSON.stringify({ path, payload });
    if (operation.current?.body !== body) operation.current = { body, key: crypto.randomUUID() };
    try {
      await api(path, { method, body: JSON.stringify({ ...payload, idempotencyKey: operation.current.key }) });
      operation.current = null; setConfirmation(null); setNotice(message);
      if (method === 'POST') setForm(current => ({ ...current, qty: '' }));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes'); }
    finally { pending.current = false; setBusy(false); }
  }
  function add(e: FormEvent) {
    e.preventDefault();
    void mutate('/api/fridge/items', 'POST', { ingredientId: form.ingredientId || null, ...(form.ingredientId ? {} : { name: form.name.trim(), category: form.category }), qty: Number(form.qty), unit: form.unit, location: form.location, ...(form.expiresOn ? { expiresOn: form.expiresOn } : {}) }, 'Food added to your fridge.');
  }
  function source(item: FridgeItem) {
    if (item.expirySource === 'user') return 'Date entered by you';
    if (item.expirySource === 'table') return ingredients.find(i => i.id === item.ingredientId)?.shelf_life_source || 'Ingredient catalog reference';
    return categories.find(c => c.category === item.category)?.source || 'Category catalog reference';
  }
  const shown = filterInventory(data?.items ?? [], { search, location: filter, category: categoryFilter, date: dateFilter }, today);
  const summary = summarizeInventory(data?.items ?? [], today);
  const selected = ingredients.find(i => i.id === form.ingredientId);
  const preview = previewExpiry(selected, categories, selected?.category ?? form.category as Category, form.location as Location, form.expiresOn, today);
  function clearFilters() { setSearch(''); setFilter('all'); setCategoryFilter('all'); setDateFilter('all'); }
  const filtered = search.trim() || filter !== 'all' || categoryFilter !== 'all' || dateFilter !== 'all';
  return <main className="mx-auto w-full max-w-6xl space-y-7 p-5 pb-16 text-stone-900 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-medium text-emerald-800">Your kitchen, kept in sync</p><h1 className="mt-1 text-3xl font-semibold">Your fridge</h1><p className="mt-2 text-sm text-stone-600">Keep track of what you have. Confirm every change before it is saved.</p></div>
      <button type="button" className={buttonClass} disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh fridge'}</button>
    </header>
    <section aria-label="Inventory summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[['Food batches', summary.total, 'all'], ['Check reference dates', summary.attention, 'attention'], ['Past reference date', summary.past, 'past'], ['No reference date', summary.noDate, 'no-date']].map(([label, count, value]) => <button type="button" key={label} aria-pressed={dateFilter === value} className={`rounded-xl border p-4 text-left ${dateFilter === value ? 'border-emerald-700 bg-emerald-50' : 'border-stone-200 bg-white'}`} onClick={() => { setDateFilter(String(value)); setConfirmation(null); }}><span className="block text-2xl font-semibold">{count}</span><span className="mt-1 block text-xs text-stone-600">{label}</span></button>)}
    </section>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4"><p>{error}</p><button className={`${buttonClass} mt-3`} disabled={loading || busy} onClick={() => void load()}>Retry loading</button><p className="mt-2 text-xs">If a save failed, repeat the same action to retry it safely.</p></div>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">{notice}</p>}
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-labelledby="inventory-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="inventory-heading" className="text-xl font-semibold">Food on hand {data ? `(${data.items.length})` : ''}</h2>
          <label className="flex items-center gap-2 text-sm">Location<select className={inputClass} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All locations</option>{Object.entries(locations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        </div>
        <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
          <label className="text-sm">Search food<input type="search" className={`${inputClass} mt-1`} placeholder="Search by food name" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <label className="text-sm">Filter category<select className={`${inputClass} mt-1`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{Category.options.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="text-sm">Reference dates<select className={`${inputClass} mt-1`} value={dateFilter} onChange={e => setDateFilter(e.target.value)}><option value="all">All dates</option><option value="attention">Needs a date check</option><option value="past">Past reference date</option><option value="no-date">No reference date</option></select></label>
          <div className="flex items-end"><button type="button" className={buttonClass} onClick={clearFilters}>Clear filters</button></div>
        </div>
        <p className="text-xs text-stone-500" aria-live="polite">Showing {shown.length} of {summary.total} batches. Separate purchases stay separate; quantities in different units are never added together.</p>
        {loading && <p role="status" className="p-5 text-stone-600">Loading your inventory…</p>}
        {!loading && data && shown.length === 0 && <div className="rounded-xl border border-dashed border-stone-300 p-8"><h3 className="font-medium">{filtered ? 'No food matches these filters' : 'Your fridge is ready for its first ingredient'}</h3><p className="mt-2 text-sm text-stone-600">{filtered ? "Clear a filter or try a different food name." : "Add food using the form, or scan a shopping receipt."}</p></div>}
        {shown.map(item => {
          const days = item.expiresOn ? referenceDays(item.expiresOn, today) : null;
          const needsAttention = data?.expiringSoon.includes(item.id);
          return <article key={item.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-lg">{item.qty} <span className="text-sm text-stone-500">{item.unit} · {locations[item.location]}</span></p></div>
              <span className={`rounded-full px-3 py-1 text-xs ${needsAttention ? 'bg-amber-100 text-amber-950' : 'bg-stone-100 text-stone-700'}`}>{days === null ? 'No date reference' : days < 0 ? 'Past reference date' : days === 0 ? 'Reference date today' : `Reference: ${days} days left`}</span>
            </div>
            <p className="mt-3 text-xs text-stone-600">{item.expiresOn ? `${item.expiresOn} · ` : ''}Typical storage guide, not a safety assessment. Source: {source(item)}.</p>
            <p className="mt-1 text-xs text-stone-500">{item.kind === 'generic' ? 'Unmatched food · not counted as a catalog ingredient in recipes' : item.kind === 'dish' ? 'Cooked leftovers' : 'Catalog ingredient'} · Added {item.addedOn}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => setConfirmation({ itemId: item.id, status: 'used' })}>Mark used</button>
              <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => setConfirmation({ itemId: item.id, status: 'tossed' })}>Discard</button>
            </div>
            {confirmation?.itemId === item.id && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3" role="group" aria-label="Confirm inventory change"><p className="text-sm">Mark all remaining {item.qty} {item.unit} of {item.name} as {confirmation.status === 'used' ? 'used' : 'discarded'}?</p><div className="mt-2 flex gap-2"><button type="button" className={buttonClass} disabled={busy || loading} onClick={() => void mutate(`/api/fridge/items/${item.id}`, 'PATCH', { status: confirmation.status }, confirmation.status === 'used' ? 'Marked as used.' : 'Marked as discarded.')}>Confirm {confirmation.status === 'used' ? 'used' : 'discard'}</button><button type="button" className={buttonClass} disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div></div>}
          </article>;
        })}
        {data && data.expiringSoon.length > 0 && <p className="text-sm text-amber-900">{data.expiringSoon.length} item(s) need a date check. Review the reference date and your food&apos;s condition before deciding what to do.</p>}
      </section>
      <aside className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Add food</h2><p className="mb-4 mt-1 text-sm text-stone-600">Choose a catalog ingredient for recipe matching, or add an unmatched food.</p>
        <Link href="/receipts/new" className="mb-4 inline-block text-sm font-medium text-emerald-800 underline">Bought several things? Scan a receipt</Link>
        <form onSubmit={add} className="space-y-3">
          <label className="block text-sm">Ingredient<select className={`${inputClass} mt-1`} value={form.ingredientId} onChange={e => { const chosen = ingredients.find(i => i.id === e.target.value); setForm({ ...form, ingredientId: e.target.value, unit: chosen?.base_unit ?? 'count' }); }}>
            <option value="">Other / unmatched food</option>{ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select></label>
          {!form.ingredientId && <><label className="block text-sm">Food name<input className={`${inputClass} mt-1`} required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="block text-sm">Category<select className={`${inputClass} mt-1`} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Category.options.map(c => <option key={c} value={c}>{c}</option>)}</select></label></>}
          <div className="grid grid-cols-2 gap-3"><label className="text-sm">Quantity<input className={`${inputClass} mt-1`} type="number" min="0.01" step="any" required value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></label><label className="text-sm">Unit<select className={`${inputClass} mt-1`} disabled={Boolean(form.ingredientId)} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as Props['ingredients'][number]['base_unit'] })}><option value="g">g</option><option value="ml">ml</option><option value="count">count</option></select></label></div>
          <label className="block text-sm">Store in<select className={`${inputClass} mt-1`} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>{Object.entries(locations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label className="block text-sm">Reference date (optional)<input className={`${inputClass} mt-1`} type="date" value={form.expiresOn} onChange={e => setForm({ ...form, expiresOn: e.target.value })} /></label>
          <p className="text-xs text-stone-500">Leave blank to use the catalog&apos;s typical guide, if available. Some seed references are placeholders. A date never certifies food safety.</p>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs" aria-live="polite"><p className="font-medium">Before you add</p><p className="mt-1">{selected?.name || form.name.trim() || 'Your food'} · {form.qty || '—'} {form.unit} · {locations[form.location as Location]}</p><p className="mt-1">{preview.expiresOn ? `Reference date: ${preview.expiresOn}` : 'No storage guide is available; no date will be guessed.'}</p>{preview.source && <p className="mt-1">Typical guide only. Source: {preview.source}.</p>}</div>
          <button type="submit" disabled={busy || loading} className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-white hover:bg-emerald-900 disabled:opacity-50">{busy ? 'Saving…' : 'Confirm and add food'}</button>
        </form>
      </aside>
    </div>
    {data && data.cookNow.length > 0 && <section aria-labelledby="cook-heading"><h2 id="cook-heading" className="text-xl font-semibold">What could you cook?</h2><p className="mt-1 text-sm text-stone-600">Ranked by catalog ingredients on hand and reference dates. Check missing ingredients and the recipe before cooking.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{data.cookNow.map(recipe => <Link key={recipe.recipeId} href={`/recipes/${recipe.recipeId}`} className="rounded-xl border border-stone-200 bg-white p-4 hover:border-emerald-700"><h3 className="font-medium">{recipe.title}</h3><p className="mt-2 text-sm">{Math.round(recipe.coverage * 100)}% ingredient coverage</p><p className="mt-1 text-xs text-stone-600">{recipe.missingIngredientIds.length} missing ingredient(s) · {recipe.usesExpiringItemIds.length} date-sensitive item(s)</p><p className="mt-2 text-sm text-stone-700">{recipe.missingIngredientIds.length ? `Missing: ${recipe.missingIngredientIds.map(id => ingredients.find(i => i.id === id)?.name ?? id).join(", ")}` : "Required ingredients covered by your stock and staple preferences."}</p></Link>)}</div></section>}
    {data && data.cookNow.length === 0 && <section className="rounded-xl border border-dashed border-stone-300 p-5"><h2 className="font-semibold">No recipe matches to show yet</h2><p className="mt-2 text-sm text-stone-600">Recipe suggestions use the shared catalog and your exclusions.</p><Link href="/recipes" className="mt-2 inline-block text-sm text-emerald-800 underline">Browse recipes</Link></section>}
    <p className="text-xs text-stone-500">MVP: manual add, used/discarded and separate batches. Editing quantity, location or date awaits the shared atomic transaction update.</p>
  </main>;
}
