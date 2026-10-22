'use client';
// Owner: Fridge. The landing page: the virtual fridge (VirtualFridge.tsx), where plated dishes you
// can cook today go into your plan with a tap, then what's inside, with adding, filtering, and
// editing a batch (quantity, location, date: FRG2, FRG4) or marking it used or discarded. Every
// change sends the quantity the person saw (expectedQty); a batch changed elsewhere returns 409
// and the list refreshes before anything is confirmed again.
import Link from 'next/link';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Category, FridgeView, type FridgeItem, type Location } from '@spec/contract';
import { filterInventory, summarizeInventory, previewExpiry, referenceDays } from '@/modules/fridge/presentation';
import type { IngredientRow, CategoryRow } from '@/modules/fridge/data';
import { EmptyState, Page, Section } from '@/ui/Page';
import { PlanPicksBar } from '@/ui/PlanPick';
import { alert, btnPrimary as primaryClass, btnSecondary, btnSecondarySm as buttonClass, btnText, chip, chipOff, chipOn, chipRow, field as inputClass, h2, label, note, notice as noticeClass, panel, rows, tag, tagNeutral, tagPast } from '@/ui/styles';
import ItemEditor from './ItemEditor';
import { VirtualFridge } from './VirtualFridge';

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
  const [adding, setAdding] = useState(false);
  function addByHand() {
    setAdding(true);
    requestAnimationFrame(() => document.getElementById('add-food')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
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
    kicker="Your kitchen"
    title="Your fridge"
    description={(data?.items.length ?? 0) > 0 ? 'Tap a dish to put it in your plan.' : undefined}
  >
    {data && <VirtualFridge cookNow={data.cookNow} items={data.items} expiringSoon={data.expiringSoon} today={today} onAddByHand={addByHand} />}
    <PlanPicksBar />

    <Section
      title={<span id="inside" className="scroll-mt-24">What&apos;s inside</span>}
      note="Dates are a typical storage guide, not a safety check."
      actions={<div className="flex items-center gap-4">
        <button type="button" className={btnText} onClick={() => (adding ? setAdding(false) : addByHand())} aria-expanded={adding}>{adding ? 'Close the form' : 'Add by hand'}</button>
        <Link href="/receipts/new" className={btnText}>Stock up</Link>
      </div>}
      className="scroll-mt-24 !mt-14"
    >
    {error && (
      <div role="alert" className={`mb-5 ${alert}`}>
        <p>{error}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className={buttonClass} disabled={loading || busy} onClick={() => void load()}>Try again</button>
          <span className="text-xs">If a save failed, repeating the same action is safe.</span>
        </div>
      </div>
    )}
    {notice && <p role="status" className={`pop-in mb-5 ${noticeClass}`}>{notice}</p>}

    {adding && (
      <section id="add-food" aria-labelledby="add-heading" className={`rise-in mb-10 scroll-mt-24 p-5 sm:p-6 ${panel}`}>
        <h2 id="add-heading" className={h2}>Add food</h2>
        <p className="mt-1.5 text-[15px] text-muted">Pick an ingredient from the list so recipes can use it, or choose &ldquo;Other&rdquo; for anything else.</p>
        <form onSubmit={add} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`${label} sm:col-span-2`}>
            Ingredient
            <select className={inputClass} value={form.ingredientId} onChange={e => { const chosen = ingredients.find(i => i.id === e.target.value); setForm({ ...form, ingredientId: e.target.value, unit: chosen?.base_unit ?? 'count' }); }}>
              <option value="">Other food (not in the list)</option>{ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          {!form.ingredientId && <>
            <label className={label}>
              Food name
              <input className={inputClass} required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className={label}>
              Category
              <select className={inputClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Category.options.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </label>
          </>}
          <label className={label}>
            Quantity
            <input className={inputClass} type="number" min="0.01" step="any" required value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
          </label>
          <label className={label}>
            Unit
            <select className={inputClass} disabled={Boolean(form.ingredientId)} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as Props['ingredients'][number]['base_unit'] })}><option value="g">g</option><option value="ml">ml</option><option value="count">count</option></select>
          </label>
          <label className={label}>
            Store in
            <select className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>{Object.entries(locations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
          </label>
          <label className={label}>
            <span>Use-by date <span className="font-normal text-subtle">(optional)</span></span>
            <input className={inputClass} type="date" value={form.expiresOn} onInput={e => setForm({ ...form, expiresOn: e.currentTarget.value })} onChange={e => setForm({ ...form, expiresOn: e.target.value })} />
          </label>
          <div className="flex flex-col gap-4 border-t border-line pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between lg:col-span-4" aria-live="polite">
            <p className="text-sm text-muted">{preview.expiresOn ? <>Typical use-by: {preview.expiresOn}{preview.source ? ` (source: ${preview.source})` : ''}. Leave the date blank to use it.</> : 'No storage guide for this food, so no date is set unless you enter one.'}</p>
            <button type="submit" disabled={busy || loading} className={`w-full sm:w-auto ${primaryClass}`}>{busy ? 'Adding…' : 'Add to fridge'}</button>
          </div>
        </form>
      </section>
    )}

    <div className={chipRow} role="tablist" aria-label="Filter by date">
      {tabs.map(([text, count, value]) => (
        <button type="button" role="tab" key={value} aria-selected={dateFilter === value} onClick={() => { setDateFilter(value); setConfirmation(null); }} className={`${chip} ${dateFilter === value ? chipOn : chipOff}`}>
          {text} <span className="tabular-nums opacity-70">{count}</span>
        </button>
      ))}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
      <div className="relative col-span-2 sm:col-span-1">
        <label className="sr-only" htmlFor="fridge-search">Search food</label>
        <MagnifyingGlass size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
        <input id="fridge-search" type="search" className={`${inputClass} !pl-11`} placeholder="Search food" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <select aria-label="Location" className={inputClass} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All locations</option>{Object.entries(locations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
      <select aria-label="Category" className={inputClass} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{Category.options.map(c => <option key={c} value={c}>{c}</option>)}</select>
      {filtered ? <button type="button" className={`${btnSecondary} col-span-2 sm:col-span-1`} onClick={clearFilters}>Clear</button> : <span className="hidden sm:block" />}
    </div>

    <section aria-label="Food on hand" className="mt-5">
      {loading && <p role="status" className="py-6 text-[15px] text-muted">Loading your fridge…</p>}
      {!loading && data && shown.length === 0 && !filtered && (
        <p className="rounded-2xl bg-sunken/60 px-4 py-5 text-[15px] text-muted">Nothing in here yet. Stock up from a receipt or add food by hand, and it shows up here.</p>
      )}
      {!loading && data && shown.length === 0 && filtered && (
        <EmptyState
          mood="thinking"
          pose="think"
          title="Nothing matches"
          action={<button type="button" className={btnSecondary} onClick={clearFilters}>Clear filters</button>}
        >
          Clear one of those filters, or try another name.
        </EmptyState>
      )}
      {shown.length > 0 && (
        <ul className={rows}>
          {shown.map(item => {
            const days = item.expiresOn ? referenceDays(item.expiresOn, today) : null;
            const needsAttention = data?.expiringSoon.includes(item.id);
            return (
              <li key={item.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted">{item.qty}{item.unit === 'count' ? '' : ` ${item.unit}`} · {locations[item.location]}{item.kind === 'dish' ? ' · leftovers' : item.kind === 'generic' ? ' · not used by recipes' : ''}</p>
                    {item.expiresOn && <p className="mt-0.5 text-xs text-subtle">{item.expirySource === 'user' ? 'Date entered by you' : `Typical guide, not a safety check · ${source(item)}`}</p>}
                  </div>
                  <span title={`Typical storage guide. Source: ${source(item)}. Added ${item.addedOn}.`} className={days !== null && days < 0 ? tagPast : needsAttention ? tag : tagNeutral}>{days === null ? 'No date' : days < 0 ? `Past its date (${item.expiresOn})` : days === 0 ? 'Use today' : `${days} day${days === 1 ? '' : 's'} left`}</span>
                  <div className="flex gap-2">
                    <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => { setConfirmation(null); setEditing({ item }); }}>Edit</button>
                    <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => { setEditing(null); setConfirmation({ item, status: 'used' }); }}>Used</button>
                    <button className={buttonClass} disabled={busy || loading} type="button" onClick={() => { setEditing(null); setConfirmation({ item, status: 'tossed' }); }}>Discard</button>
                  </div>
                </div>
                {/* Food on a clock: suggest the freezer when it has a guide there (the fridge shelves above already show dishes that use it). */}
                {needsAttention && item.location !== 'freezer' && previewExpiry(ingredients.find(i => i.id === item.ingredientId), categories, item.category ?? 'prepared', 'freezer', '', today).expiresOn && editing?.item.id !== item.id && (
                  <button type="button" className={`mt-2 text-sm ${btnText}`} disabled={busy || loading} onClick={() => { setConfirmation(null); setEditing({ item, location: 'freezer' }); }}>Won&apos;t get to it? Review a move to the freezer</button>
                )}
                {editing?.item.id === item.id && (
                  <ItemEditor key={`${item.id}:${editing.location ?? item.location}`} item={editing.item} initialLocation={editing.location} ingredients={ingredients} categories={categories} today={today} busy={busy || loading} onCancel={() => setEditing(null)} onSave={patch => void mutate(`/api/fridge/items/${item.id}`, 'PATCH', patch, 'Batch updated.')} />
                )}
                {confirmation?.item.id === item.id && (
                  <div className={`pop-in mt-3 flex flex-wrap items-center justify-between gap-3 ${note}`} role="group" aria-label="Confirm change">
                    <p>{confirmation.status === 'used' ? 'Mark' : 'Discard'} all {item.qty}{item.unit === 'count' ? '' : ` ${item.unit}`} of {item.name}{confirmation.status === 'used' ? ' as used' : ''}?</p>
                    <div className="flex gap-2">
                      <button type="button" className={`${primaryClass} !h-10 sm:!h-9 !px-4 !text-sm`} disabled={busy || loading} onClick={() => void mutate(`/api/fridge/items/${item.id}`, 'PATCH', { status: confirmation.status, expectedQty: confirmation.item.qty }, confirmation.status === 'used' ? 'Marked as used.' : 'Discarded.')}>{confirmation.status === 'used' ? 'Mark used' : 'Discard'}</button>
                      <button type="button" className={buttonClass} disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > 0 && <p className="mt-3 text-xs text-subtle" aria-live="polite">Showing {shown.length} of {summary.total}. Each purchase stays a separate entry. Dates are a typical guide; each one names its source.</p>}
    </section>

    </Section>
  </Page>;
}
