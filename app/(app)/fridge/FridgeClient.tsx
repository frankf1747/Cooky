'use client';

import Link from 'next/link';
import ItemEditor from './ItemEditor';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Category, FridgeView, type FridgeItem, type Location } from '@spec/contract';
import { filterInventory, summarizeInventory, previewExpiry, referenceDays } from '@/modules/fridge/presentation';
import type { IngredientRow, CategoryRow } from '@/modules/fridge/data';
import { BaoSays } from '@/ui/Bao';
import { Page } from '@/ui/Page';
import { alert, btnPrimary as primaryClass, btnSecondarySm as buttonClass, chip, chipOff, chipOn, chipRow, field as inputClass, tag } from '@/ui/styles';

type Props = { initial: FridgeView; ingredients: IngredientRow[]; categories: CategoryRow[]; today: string };
class RequestError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
const locations = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry' };
async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json();
  if (!res.ok) throw new RequestError(res.status, body.code ?? '', `${body.error ?? 'Request failed'}${body.message ? `: ${body.message}` : ''}${body.code ? ` (${body.code})` : ''}${body.requestId ? ` · ${body.requestId}` : ''}`);
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
  const [confirmation, setConfirmation] = useState<{ item: FridgeItem; status: 'used' | 'tossed' } | null>(null);
  const [editing, setEditing] = useState<{ item: FridgeItem; location?: Location } | null>(null);
  const [adding, setAdding] = useState(initial.items.length === 0);
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
      operation.current = null; setConfirmation(null); setEditing(null); setNotice(message);
      if (method === 'POST') setForm(current => ({ ...current, qty: '' }));
      await load();
    } catch (e) {
      if (e instanceof RequestError && e.status === 409) {
        operation.current = null; setConfirmation(null); setEditing(null);
        await load();
        setError('This batch changed in another operation. Review the refreshed stock and open it again before confirming.');
      } else setError(e instanceof Error ? e.message : 'Could not save changes');
    }
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
  const tabs: [string, number, string][] = [['All', summary.total, 'all'], ['Use soon', summary.attention, 'attention'], ['Past date', summary.past, 'past'], ['No date', summary.noDate, 'no-date']];
  return <Page
    title="Fridge"
    description="What you have and what to use first. Dates are a typical storage guide, not a safety check."
    width="wide"
    actions={<>
      <button type="button" className={primaryClass} onClick={() => setAdding(a => !a)} aria-expanded={adding}>{adding ? 'Close' : 'Add food'}</button>
      <Link href="/receipts/new" className={buttonClass}>Scan a receipt</Link>
    </>}
  >
    {error && <div role="alert" className={`mb-4 ${alert}`}><p>{error}</p><div className="mt-2 flex items-center gap-3"><button className={buttonClass} disabled={loading || busy} onClick={() => void load()}>Try again</button><span className="text-xs">If a save failed, repeating the same action is safe.</span></div></div>}
    {notice && <div role="status" className="pop-in mb-4"><BaoSays mood="happy">{notice}</BaoSays></div>}

    {adding && <section aria-labelledby="add-heading" className="mb-8 rounded-2xl border border-zinc-200 bg-surface p-4 sm:p-5 dark:border-zinc-800">
      <h2 id="add-heading" className="font-display text-xl font-semibold tracking-tight">Add food</h2>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">Pick an ingredient from the list so recipes can use it, or choose &ldquo;Other&rdquo; for anything else.</p>
      <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm sm:col-span-2">Ingredient<select className={`${inputClass} mt-1`} value={form.ingredientId} onChange={e => { const chosen = ingredients.find(i => i.id === e.target.value); setForm({ ...form, ingredientId: e.target.value, unit: chosen?.base_unit ?? 'count' }); }}>
          <option value="">Other food (not in the list)</option>{ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select></label>
        {!form.ingredientId && <><label className="block text-sm">Food name<input className={`${inputClass} mt-1`} required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="block text-sm">Category<select className={`${inputClass} mt-1`} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Category.options.map(c => <option key={c} value={c}>{c}</option>)}</select></label></>}
        <label className="block text-sm">Quantity<input className={`${inputClass} mt-1`} type="number" min="0.01" step="any" required value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></label>
        <label className="block text-sm">Unit<select className={`${inputClass} mt-1`} disabled={Boolean(form.ingredientId)} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as Props['ingredients'][number]['base_unit'] })}><option value="g">g</option><option value="ml">ml</option><option value="count">count</option></select></label>
        <label className="block text-sm">Store in<select className={`${inputClass} mt-1`} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>{Object.entries(locations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label className="block text-sm">Use-by date (optional)<input className={`${inputClass} mt-1`} type="date" value={form.expiresOn} onInput={e => setForm({ ...form, expiresOn: e.currentTarget.value })} onChange={e => setForm({ ...form, expiresOn: e.target.value })} /></label>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4" aria-live="polite">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{preview.expiresOn ? <>Typical use-by: {preview.expiresOn}{preview.source ? ` (source: ${preview.source})` : ''}. Leave the date blank to use it.</> : 'No storage guide for this food, so no date is set unless you enter one.'}</p>
          <button type="submit" disabled={busy || loading} className={primaryClass}>{busy ? 'Adding…' : 'Add to fridge'}</button>
        </div>
      </form>
    </section>}

    <div className={chipRow} role="tablist" aria-label="Filter by date">
      {tabs.map(([label, count, value]) => <button type="button" role="tab" key={value} aria-selected={dateFilter === value} onClick={() => { setDateFilter(value); setConfirmation(null); }} className={`${chip} ${dateFilter === value ? chipOn : chipOff}`}>{label} <span className="opacity-70">{count}</span></button>)}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
      <div className="col-span-2 sm:col-span-1">
      <label className="sr-only" htmlFor="fridge-search">Search food</label>
      <input id="fridge-search" type="search" className={inputClass} placeholder="Search food" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <select aria-label="Location" className={inputClass} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All locations</option>{Object.entries(locations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
      <select aria-label="Category" className={inputClass} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{Category.options.map(c => <option key={c} value={c}>{c}</option>)}</select>
      {filtered ? <button type="button" className={`${buttonClass} col-span-2 sm:col-span-1`} onClick={clearFilters}>Clear</button> : <span className="hidden sm:block" />}
    </div>

    <section aria-label="Food on hand" className="mt-4">
      {loading && <div role="status" className="py-4"><BaoSays mood="thinking">Checking what is in your fridge.</BaoSays></div>}
      {!loading && data && shown.length === 0 && <div className="py-4"><BaoSays mood={filtered ? 'thinking' : 'sleepy'} pose="hold" prop="basket">{filtered ? 'Nothing matches those filters. Clear one, or try another name.' : 'The fridge is empty. Echoes, even. Scan a receipt or add food by hand and I will keep track of it.'}</BaoSays>{filtered ? <button type="button" className={`${buttonClass} mt-4`} onClick={clearFilters}>Clear filters</button> : <div className="mt-4 flex gap-2"><Link href="/receipts/new" className={primaryClass}>Scan a receipt</Link>{!adding && <button type="button" className={buttonClass} onClick={() => setAdding(true)}>Add food</button>}</div>}</div>}
      {shown.length > 0 && <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-surface dark:divide-zinc-800 dark:border-zinc-800">
        {shown.map(item => {
          const days = item.expiresOn ? referenceDays(item.expiresOn, today) : null;
          const needsAttention = data?.expiringSoon.includes(item.id);
          return <li key={item.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.qty}{item.unit === 'count' ? '' : ` ${item.unit}`} · {locations[item.location]}{item.kind === 'dish' ? ' · leftovers' : item.kind === 'generic' ? ' · not used by recipes' : ''}</p>
              </div>
              <span title={`Typical storage guide. Source: ${source(item)}. Added ${item.addedOn}.`} className={days !== null && days < 0 ? 'inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200' : needsAttention ? tag : 'inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}>{days === null ? 'No date' : days < 0 ? `Past its date (${item.expiresOn})` : days === 0 ? 'Use today' : `${days} day${days === 1 ? '' : 's'} left`}</span>
              <div className="flex gap-2">
                <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => { setConfirmation(null); setEditing({ item }); }}>Edit batch</button>
                <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => { setEditing(null); setConfirmation({ item, status: 'used' }); }}>Used</button>
                <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => { setEditing(null); setConfirmation({ item, status: 'tossed' }); }}>Discard</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{item.expirySource === 'user' ? 'Reference date entered by you' : 'Typical storage guide'}. Source: {source(item)}. A date is not a safety assessment.</p>
            {editing?.item.id === item.id && <ItemEditor key={`${item.id}:${editing.location ?? item.location}`} item={editing.item} initialLocation={editing.location} ingredients={ingredients} categories={categories} today={today} busy={busy || loading} onCancel={() => setEditing(null)} onSave={patch => void mutate(`/api/fridge/items/${item.id}`, 'PATCH', patch, 'Batch updated.')} />}
            {needsAttention && <div className="mt-3 space-y-2 text-sm"><p className="text-zinc-600 dark:text-zinc-400">Check the date and condition before deciding what to do.</p>{data?.cookNow.find(r => r.usesExpiringItemIds.includes(item.id)) && <Link className="block underline" href={`/recipes/${data.cookNow.find(r => r.usesExpiringItemIds.includes(item.id))!.recipeId}`}>View a recipe using this ingredient</Link>}{item.location !== 'freezer' && previewExpiry(ingredients.find(i => i.id === item.ingredientId), categories, item.category ?? 'prepared', 'freezer', '', today).expiresOn && <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => { setConfirmation(null); setEditing({ item, location: 'freezer' }); }}>Review move to freezer</button>}</div>}
            {confirmation?.item.id === item.id && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-3" role="group" aria-label="Confirm change"><p className="text-sm">{confirmation.status === 'used' ? 'Mark' : 'Discard'} all {item.qty}{item.unit === 'count' ? '' : ` ${item.unit}`} of {item.name}{confirmation.status === 'used' ? ' as used' : ''}?</p><div className="flex gap-2"><button type="button" className={primaryClass} disabled={busy || loading} onClick={() => void mutate(`/api/fridge/items/${item.id}`, 'PATCH', { status: confirmation.status, expectedQty: confirmation.item.qty }, confirmation.status === 'used' ? 'Marked as used.' : 'Discarded.')}>{confirmation.status === 'used' ? 'Mark used' : 'Discard'}</button><button type="button" className={buttonClass} disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div></div>}
          </li>;
        })}
      </ul>}
      {shown.length > 0 && <p className="mt-2 text-xs text-zinc-500" aria-live="polite">Showing {shown.length} of {summary.total}. Each purchase stays a separate entry. Date sources are shown with each batch.</p>}
    </section>

    {data && data.cookNow.length > 0 && <section aria-labelledby="cook-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="cook-heading" className="font-display text-xl font-semibold tracking-tight">What you can cook</h2><Link href="/recipes?chips=fridge" className="text-sm font-medium hover:underline">All matching recipes</Link></div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Best matches for what you have, starting with food to use soon.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">{data.cookNow.slice(0, 6).map((recipe, i) => <li key={recipe.recipeId}><Link href={`/recipes/${recipe.recipeId}`} className={`block h-full rounded-2xl p-4 transition hover:-translate-y-0.5 ${i % 2 ? 'bg-tile-mint' : 'bg-tile-sky'}`}><p className="font-display text-lg font-semibold leading-tight tracking-tight">{recipe.title}</p><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{recipe.missingIngredientIds.length ? `Missing: ${recipe.missingIngredientIds.map(id => ingredients.find(i => i.id === id)?.name ?? id).join(', ')}` : 'You have everything it needs.'}</p>{recipe.usesExpiringItemIds.length > 0 && <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Uses {recipe.usesExpiringItemIds.length} item{recipe.usesExpiringItemIds.length === 1 ? '' : 's'} to use soon</p>}</Link></li>)}</ul>
    </section>}
  </Page>;
}
