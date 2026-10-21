"use client";
// Owner: Plan & Shop. The plan request form (PLN1). Posts to /api/plans and opens the draft.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUsd } from "@/platform/money";
import type { PlanFormData } from "@/modules/planning";
import { formatQty, planErrorMessage, type ApiErrorBody } from "./ui";

type Limits = { servingsMin: number; servingsMax: number; mealsMin: number; mealsMax: number; wishesMaxChars: number };

const CHIP_ON = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
const CHIP_OFF = "border-zinc-300 dark:border-zinc-700";
const input = "rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export function PlanForm({ data, limits, preselected = [] }: { data: PlanFormData; limits: Limits; preselected?: string[] }) {
  const router = useRouter();
  const d = data.defaults;
  const [servings, setServings] = useState(d.servings);
  const [budget, setBudget] = useState((d.budgetCents / 100).toFixed(2));
  const [maxMinutes, setMaxMinutes] = useState(d.maxMinutes);
  const [picked, setPicked] = useState<string[]>(preselected);
  const [meals, setMeals] = useState(Math.min(limits.mealsMax, Math.max(d.meals, preselected.length)));
  const [wishes, setWishes] = useState("");
  const [mustUse, setMustUse] = useState<string[]>([]);
  // One key per distinct request: a retry of the same choices reuses it, so it can never create two plans.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof planErrorMessage> | null>(null);

  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setKey(crypto.randomUUID());
    setError(null);
  };

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const budgetCents = Math.round(Number(budget) * 100);
    if (!Number.isFinite(budgetCents) || budgetCents < 0) return setError({ message: "Enter a budget in dollars, like 40 or 35.50.", retry: false });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          servings, budgetCents, maxMinutes, meals,
          ...(wishes.trim() ? { wishes: wishes.trim() } : {}),
          ...(mustUse.length ? { mustUseItemIds: mustUse } : {}),
          ...(picked.length ? { mustIncludeRecipeIds: picked } : {}),
          idempotencyKey: key,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(planErrorMessage(res.status, body as ApiErrorBody, formatUsd));
      router.push(`/plan/${body.plan.planId}`);
    } catch {
      setError({ message: "Couldn't reach Cooky. Check your connection and try again.", retry: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5" aria-busy={busy}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          People
          <select className={input} value={servings} onChange={(e) => changed(setServings)(Number(e.target.value))} disabled={busy}>
            {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Dinners
          <select className={input} value={meals} onChange={(e) => changed(setMeals)(Number(e.target.value))} disabled={busy}>
            {Array.from({ length: limits.mealsMax - limits.mealsMin + 1 }, (_, i) => limits.mealsMin + i).map((n) => (
              <option key={n} value={n} disabled={n < picked.length}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Budget ($)
          <input className={input} inputMode="decimal" value={budget} onChange={(e) => changed(setBudget)(e.target.value)} disabled={busy} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Max minutes
          <input className={input} type="number" min={5} step={5} value={maxMinutes} onChange={(e) => changed(setMaxMinutes)(Number(e.target.value))} disabled={busy} required />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">
          Dishes you want this week <span className="text-zinc-500">(optional · Cooky fills the other {Math.max(0, meals - picked.length)})</span>
        </legend>
        {data.recipes.length === 0 ? (
          <p className="text-zinc-500">No recipes in the library yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.recipes.map((r) => {
              const on = picked.includes(r.id);
              const full = !on && picked.length >= meals;
              return (
                <label key={r.id} className={`relative flex items-center gap-2 rounded-full border px-3 py-1 ${on ? CHIP_ON : CHIP_OFF} ${full ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={busy || full}
                    onChange={(e) => changed(setPicked)(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))}
                  />
                  {r.title} <span className="opacity-70">· {r.minutes} min</span>
                </label>
              );
            })}
          </div>
        )}
        {picked.length > 0 && picked.length >= meals && <p className="text-xs text-zinc-500">You picked a dish for every dinner. Add a dinner to let Cooky suggest one.</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Use up from your fridge <span className="text-zinc-500">(optional)</span></legend>
        {data.fridgeItems.length === 0 ? (
          <p className="text-zinc-500">
            Your fridge is empty in Cooky. <Link className="underline" href="/receipts/new">Scan a receipt</Link> or{" "}
            <Link className="underline" href="/fridge">add items</Link> and plans will start from what you have.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.fridgeItems.map((f) => (
              <label key={f.id} className={`relative flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 ${mustUse.includes(f.id) ? CHIP_ON : CHIP_OFF}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={mustUse.includes(f.id)}
                  disabled={busy}
                  onChange={(e) => changed(setMustUse)(e.target.checked ? [...mustUse, f.id] : mustUse.filter((x) => x !== f.id))}
                />
                {f.name} · {formatQty(f.qty, f.unit)}
                {f.expiresOn && (
                  <span className={f.pastUseBy ? "text-amber-600 dark:text-amber-400" : "opacity-70"}>
                    · {f.pastUseBy ? "past typical use-by" : "use by"} {f.expiresOn}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
        {data.fridgeItems.length > 0 && <p className="text-xs text-zinc-500">Use-by dates are a typical guide, not safety advice.</p>}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span>Anything in mind? <span className="text-zinc-500">(optional)</span></span>
        <textarea
          className={`${input} min-h-20`}
          maxLength={limits.wishesMaxChars}
          placeholder="e.g. something light midweek, one vegetarian night"
          value={wishes}
          onChange={(e) => changed(setWishes)(e.target.value)}
          disabled={busy}
        />
      </label>

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p>{error.message}</p>
          <div className="mt-2 flex gap-3">
            {error.retry && (
              <button type="button" onClick={() => submit()} disabled={busy} className="underline disabled:opacity-50">
                Try again
              </button>
            )}
            {error.upgrade && <Link className="underline" href="/billing">Unlock Pro</Link>}
          </div>
        </div>
      )}

      <button disabled={busy} className="self-start rounded-md bg-zinc-900 px-5 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {busy ? "Planning… this can take a few seconds" : "Plan my meals"}
      </button>
    </form>
  );
}
