"use client";
// Owner: Receipts. The review screen (RCT4, RCT6, RCT10): flagged lines first and unticked,
// auto and generic lines ticked, non-food collapsed. Nothing changes the fridge until confirm.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category, Location, ReceiptLine, Unit } from "@spec/contract";
import { formatUsd } from "@/platform/money";
import { alert, btnPrimary, btnText, panel } from "@/ui/styles";
import { FLAG_TEXT, confirmBody, receiptErrorMessage, toEdit, type ApiErrorBody, type EditLine, type ReceiptError } from "../ui";

/** Compact controls for a receipt line; several share one row. */
const field = "min-w-0 rounded-lg border border-zinc-300 bg-surface px-2 py-1.5 text-sm dark:border-zinc-700";

const UNITS: Unit[] = ["g", "ml", "count"];
const LOCATIONS: Location[] = ["fridge", "freezer", "pantry"];

export function ReviewForm({ receiptId, lines, categories }: { receiptId: string; lines: ReceiptLine[]; categories: readonly Category[] }) {
  const router = useRouter();
  const food = lines.filter((l) => l.decision !== "ignored");
  const ignored = lines.filter((l) => l.decision === "ignored");
  const [edits, setEdits] = useState<Record<string, EditLine>>(() => Object.fromEntries(food.map((l) => [l.lineId, toEdit(l)])));
  const [problems, setProblems] = useState<Record<string, string>>({});
  // One key per set of choices: a retry of the same choices can never add the items twice.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReceiptError | null>(null);

  const flagged = food.filter((l) => l.decision === "flagged");
  const accepted = food.filter((l) => l.decision !== "flagged");
  const ticked = Object.values(edits).filter((e) => e.include).length;

  function change(lineId: string, patch: Partial<EditLine>) {
    setEdits((all) => ({ ...all, [lineId]: { ...all[lineId], ...patch } }));
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
      <li key={l.lineId} className={`p-3 ${panel}`}>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={e.include}
            onChange={(ev) => change(l.lineId, { include: ev.target.checked })}
            disabled={busy}
            aria-label={`Add ${e.name || l.raw} to the fridge`}
            className="mt-1 size-4"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {editableName ? (
                <input value={e.name} onChange={(ev) => change(l.lineId, { name: ev.target.value })} disabled={busy} aria-label="Name" className={`${field} font-medium`} />
              ) : (
                <span className="font-medium">{e.name}</span>
              )}
              <span className="text-sm text-zinc-500">{l.priceCents !== null ? formatUsd(l.priceCents) : "price not read"}</span>
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">{l.raw}</p>
            {l.decision === "generic" && <p className="mt-1 text-xs text-zinc-500">Not in Cooky&apos;s catalog: added as a general {l.category} item; plans won&apos;t count it.</p>}
            {l.flagReason && <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{FLAG_TEXT[l.flagReason]}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                inputMode="decimal"
                value={e.qty}
                onChange={(ev) => change(l.lineId, { qty: ev.target.value })}
                disabled={busy}
                aria-label="Amount"
                placeholder="Amount"
                className={`${field} w-24`}
              />
              <select value={e.unit ?? ""} onChange={(ev) => change(l.lineId, { unit: (ev.target.value || null) as Unit | null })} disabled={busy} aria-label="Unit" className={field}>
                <option value="">unit…</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
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
              <label className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                Use by
                <input type="date" value={e.expiresOn} onChange={(ev) => change(l.lineId, { expiresOn: ev.target.value })} disabled={busy} className={field} />
              </label>
            </div>
            {problems[l.lineId] && <p role="alert" className={`mt-1 ${alert}`}>{problems[l.lineId]}</p>}
          </div>
        </div>
      </li>
    );
  }

  if (food.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-zinc-600 dark:text-zinc-400">Cooky found no food on this receipt, so there is nothing to add.</p>
        <Link href="/receipts/new" className={`mt-2 inline-block ${btnText}`}>Scan another receipt</Link>
        {ignored.length > 0 && <IgnoredLines lines={ignored} />}
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      {flagged.length > 0 && (
        <div>
          <h2 className="font-semibold">Check {flagged.length === 1 ? "this one" : `these ${flagged.length}`}</h2>
          <p className="text-sm text-zinc-500">Not added unless you tick them.</p>
          <ul className="mt-2 grid gap-2">{flagged.map(row)}</ul>
        </div>
      )}

      {accepted.length > 0 && (
        <div>
          <h2 className="font-semibold">Adding to your fridge</h2>
          <ul className="mt-2 grid gap-2">{accepted.map(row)}</ul>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Use-by dates are a typical guide from Cooky&apos;s shelf-life table, counted from the purchase date. They are not a food-safety judgement; change any date you like.
      </p>

      {ignored.length > 0 && <IgnoredLines lines={ignored} />}

      <div className="flex flex-col items-stretch gap-2 sm:items-start">
        <button onClick={confirm} disabled={busy || ticked === 0} className={btnPrimary}>
          {busy ? "Adding…" : error?.retry ? "Try again" : `Add ${ticked} ${ticked === 1 ? "item" : "items"} to the fridge`}
        </button>
        {error && <p role="alert" className={alert}>{error.message}</p>}
      </div>
    </div>
  );
}

function IgnoredLines({ lines }: { lines: ReceiptLine[] }) {
  return (
    <details className="text-sm text-zinc-500">
      <summary className="cursor-pointer">Not food: {lines.length} {lines.length === 1 ? "line" : "lines"} (tax, totals, bags…)</summary>
      <ul className="mt-2 grid gap-1 font-mono text-xs">
        {lines.map((l) => <li key={l.lineId}>{l.raw}</li>)}
      </ul>
    </details>
  );
}
