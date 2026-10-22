"use client";
// Owner: Receipts. The review screen (RCT4, RCT6, RCT10): flagged lines first and unticked,
// auto and generic lines ticked, non-food collapsed. Nothing changes the fridge until confirm.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category, Location, ReceiptLine, Unit } from "@spec/contract";
import { formatUsd } from "@/platform/money";
import { Check } from "@phosphor-icons/react";
import { alert, btnPrimary, btnText, h2, note, rows, tick, tickOff, tickOn } from "@/ui/styles";
import { FLAG_TEXT, applyChange, confirmBody, receiptErrorMessage, toEdit, type ApiErrorBody, type EditLine, type ReceiptError, type ReviewShelf } from "../ui";

/** Compact controls for a receipt line; several share one row. Still 16px on phones so iOS does not zoom. */
const field =
  "min-w-0 rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-base text-foreground transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60 sm:py-1.5 sm:text-sm";

const UNITS: Unit[] = ["g", "ml", "count"];
const LOCATIONS: Location[] = ["fridge", "freezer", "pantry"];

export function ReviewForm({ receiptId, lines, categories, shelf }: { receiptId: string; lines: ReceiptLine[]; categories: readonly Category[]; shelf: ReviewShelf }) {
  const router = useRouter();
  const food = lines.filter((l) => l.decision !== "ignored");
  const ignored = lines.filter((l) => l.decision === "ignored");
  const [edits, setEdits] = useState<Record<string, EditLine>>(() => Object.fromEntries(food.map((l) => [l.lineId, toEdit(l, shelf)])));
  const [problems, setProblems] = useState<Record<string, string>>({});
  // One key per set of choices: a retry of the same choices can never add the items twice.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReceiptError | null>(null);

  const flagged = food.filter((l) => l.decision === "flagged");
  const accepted = food.filter((l) => l.decision !== "flagged");
  const ticked = Object.values(edits).filter((e) => e.include).length;

  function change(lineId: string, patch: Partial<EditLine>) {
    setEdits((all) => ({ ...all, [lineId]: applyChange(all[lineId], patch, shelf) }));
    setProblems((all) => {
      const rest = { ...all };
      delete rest[lineId];
      return rest;
    });
    setKey(crypto.randomUUID());
    setError(null);
  }

  async function confirm() {
    if (busy) return;
    const body = confirmBody(food.map((l) => edits[l.lineId]), key);
    if ("problems" in body) return setProblems(body.problems);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return setError(receiptErrorMessage(res.status, (await res.json().catch(() => ({}))) as ApiErrorBody));
      router.push("/fridge");
    } catch {
      setError(receiptErrorMessage(0, {}));
    } finally {
      setBusy(false);
    }
  }

  function row(l: ReceiptLine) {
    const e = edits[l.lineId];
    const editableName = !l.ingredientId;
    return (
      <li key={l.lineId} className="px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <label className="mt-0.5 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={e.include}
              onChange={(ev) => change(l.lineId, { include: ev.target.checked })}
              disabled={busy}
              aria-label={`Add ${e.name || l.raw} to the fridge`}
              className="peer sr-only"
            />
            <span aria-hidden className={`${tick} peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 ${e.include ? tickOn : tickOff}`}>
              {e.include && <Check size={15} weight="bold" />}
            </span>
          </label>
          <div className={`min-w-0 flex-1 transition ${e.include ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {editableName ? (
                <input value={e.name} onChange={(ev) => change(l.lineId, { name: ev.target.value })} disabled={busy} aria-label="Name" className={`${field} font-medium`} />
              ) : (
                <span className="font-medium">{e.name}</span>
              )}
              <span className="text-sm tabular-nums text-muted">{l.priceCents !== null ? formatUsd(l.priceCents) : "price not read"}</span>
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-subtle">{l.raw}</p>
            {l.decision === "generic" && <p className="mt-1 text-xs text-muted">Not in Cooky&apos;s catalog: added as a general {l.category} item; plans won&apos;t count it.</p>}
            {l.flagReason && <p className="mt-1.5 text-sm font-medium text-tomato-ink">{FLAG_TEXT[l.flagReason]}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                inputMode="decimal"
                value={e.qty}
                onChange={(ev) => change(l.lineId, { qty: ev.target.value })}
                disabled={busy}
                aria-label="Amount"
                placeholder="Amount"
                className={`${field} w-24`}
              />
              {e.unitLocked ? (
                <span className="px-1 text-sm text-muted" aria-label={`Unit: ${e.unit}`}>{e.unit === "count" ? "items" : e.unit}</span>
              ) : (
                <select value={e.unit ?? ""} onChange={(ev) => change(l.lineId, { unit: (ev.target.value || null) as Unit | null })} disabled={busy} aria-label="Unit" className={field}>
                  <option value="">unit…</option>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
              <select value={e.location ?? ""} onChange={(ev) => change(l.lineId, { location: (ev.target.value || null) as Location | null })} disabled={busy} aria-label="Where it goes" className={field}>
                <option value="">where…</option>
                {LOCATIONS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              {!l.ingredientId && (
                <select value={e.category ?? ""} onChange={(ev) => change(l.lineId, { category: (ev.target.value || null) as Category | null })} disabled={busy} aria-label="Category" className={field}>
                  <option value="">category…</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <label className="flex items-center gap-2 text-sm text-muted">
                Use by
                <input type="date" value={e.expiresOn} onChange={(ev) => change(l.lineId, { expiresOn: ev.target.value })} disabled={busy} className={field} />
              </label>
            </div>
            {problems[l.lineId] && <p role="alert" className={`mt-2 ${alert}`}>{problems[l.lineId]}</p>}
          </div>
        </div>
      </li>
    );
  }

  if (food.length === 0) {
    return (
      <div className="mt-2 grid gap-4">
        <p className={`${note} text-[15px]`}>
          Cooky found no food on this receipt, so there is nothing to add. <Link href="/receipts/new" className={btnText}>Scan another receipt</Link>
        </p>
        {ignored.length > 0 && <IgnoredLines lines={ignored} />}
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-10">
      {flagged.length > 0 && (
        <section>
          <h2 className={h2}>Check {flagged.length === 1 ? "this one" : `these ${flagged.length}`}</h2>
          <p className="mt-1.5 text-[15px] text-muted">Not added unless you tick them.</p>
          <ul className={`mt-4 ${rows}`}>{flagged.map(row)}</ul>
        </section>
      )}

      {accepted.length > 0 && (
        <section>
          <h2 className={h2}>Adding to your fridge</h2>
          <ul className={`mt-4 ${rows}`}>{accepted.map(row)}</ul>
        </section>
      )}

      <p className="-mt-4 text-xs leading-relaxed text-subtle">
        Use-by dates are a typical guide from Cooky&apos;s shelf-life table, counted from the purchase date. They are not a food-safety judgement; change any date you like.
      </p>

      {ignored.length > 0 && <IgnoredLines lines={ignored} />}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col items-stretch gap-2 border-t border-line bg-background/95 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:items-start sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button onClick={confirm} disabled={busy || ticked === 0} className={`w-full sm:w-auto ${btnPrimary}`}>
          {busy ? "Adding…" : error?.retry ? "Try again" : `Add ${ticked} ${ticked === 1 ? "item" : "items"} to the fridge`}
        </button>
        {error && <p role="alert" className={alert}>{error.message}</p>}
      </div>
    </div>
  );
}

function IgnoredLines({ lines }: { lines: ReceiptLine[] }) {
  return (
    <details className="rounded-2xl bg-sunken/60 px-4 py-1 text-sm text-muted">
      <summary className="flex min-h-11 cursor-pointer items-center">Not food: {lines.length} {lines.length === 1 ? "line" : "lines"} (tax, totals, bags…)</summary>
      <ul className="grid gap-1 pb-3 font-mono text-xs">
        {lines.map((l) => <li key={l.lineId}>{l.raw}</li>)}
      </ul>
    </details>
  );
}
