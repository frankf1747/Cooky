"use client";
// Owner: Plan & Shop. The plan request form (PLN1). Posts to /api/plans and opens the draft.
// Dishes are picked elsewhere, by tapping plates in the fridge or + on a recipe (src/ui/planPicks);
// here they are listed, can be taken out, and go in as `mustIncludeRecipeIds`. "Whatever's good"
// plans without any picks: Bao chooses every dinner within the budget and time above.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shuffle, X } from "@phosphor-icons/react";
import { formatUsd } from "@/platform/money";
import type { PlanFormData } from "@/modules/planning";
import { BaoSays } from "@/ui/Bao";
import { DishArt } from "@/ui/DishArt";
import { planPicks, usePlanPicks } from "@/ui/planPicks";
import { alert, btnPrimary, btnSecondarySm, btnText, chip, chipOff, chipOn, field as input, h2, label } from "@/ui/styles";
import { formatQty, planErrorMessage, type ApiErrorBody } from "./ui";

type Limits = { servingsMin: number; servingsMax: number; mealsMin: number; mealsMax: number; wishesMaxChars: number };

/** How many fridge foods show before "Show all". */
const FRIDGE_SHOWN = 6;

/** One numbered part of the form: a Fraunces heading with its step number, a note, the fields. */
function Group({ n, title, note, children }: { n: number; title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <h2 className={`${h2} flex items-center gap-3`} aria-hidden>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cobalt-tint font-sans text-sm font-semibold tracking-normal text-cobalt-ink">{n}</span>
        {title}
      </h2>
      {note && <p className="mt-2 text-[15px] leading-relaxed text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

export function PlanForm({ data, limits, preselected = [] }: { data: PlanFormData; limits: Limits; preselected?: string[] }) {
  const router = useRouter();
  const d = data.defaults;
  const [servings, setServings] = useState(d.servings);
  const [budget, setBudget] = useState((d.budgetCents / 100).toFixed(2));
  const [maxMinutes, setMaxMinutes] = useState(d.maxMinutes);
  // Picks live in the browser and follow the person around; only dishes still in the library count.
  const picks = usePlanPicks().filter((p) => data.recipes.some((r) => r.id === p.id));
  const picked = picks.map((p) => p.id);
  const [meals, setMeals] = useState(Math.min(limits.mealsMax, Math.max(d.meals, preselected.length)));
  // Never fewer dinners than picked dishes.
  const dinners = Math.min(limits.mealsMax, Math.max(meals, picked.length));
  const [wishes, setWishes] = useState("");
  const [mustUse, setMustUse] = useState<string[]>([]);
  const [allFridge, setAllFridge] = useState(false);
  // Food on a date first; only a few until "Show all", so this stays a short list, not a wall.
  const fridgeShown = [...data.fridgeItems]
    .sort((a, b) => Number(Boolean(b.expiresOn)) - Number(Boolean(a.expiresOn)))
    .filter((f, i) => allFridge || mustUse.includes(f.id) || i < FRIDGE_SHOWN);

  // A link like /plan?recipes=a,b adds those dishes to the picks.
  useEffect(() => {
    if (preselected.length) planPicks.add(preselected.flatMap((id) => data.recipes.filter((r) => r.id === id).map((r) => ({ id: r.id, title: r.title }))));
  }, [preselected, data.recipes]);
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
          servings, budgetCents, maxMinutes, meals: dinners,
          ...(wishes.trim() ? { wishes: wishes.trim() } : {}),
          ...(mustUse.length ? { mustUseItemIds: mustUse } : {}),
          ...(picked.length ? { mustIncludeRecipeIds: picked } : {}),
          idempotencyKey: key,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(planErrorMessage(res.status, body as ApiErrorBody, formatUsd));
      planPicks.clear();
      router.push(`/plan/${body.plan.planId}`);
    } catch {
      setError({ message: "Couldn't reach Cooky. Check your connection and try again.", retry: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8" aria-busy={busy}>
      <Group n={1} title="The basics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className={label}>
            People
            <select className={input} value={servings} onChange={(e) => changed(setServings)(Number(e.target.value))} disabled={busy}>
              {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Dinners
            <select className={input} value={dinners} onChange={(e) => changed(setMeals)(Number(e.target.value))} disabled={busy}>
              {Array.from({ length: limits.mealsMax - limits.mealsMin + 1 }, (_, i) => limits.mealsMin + i).map((n) => (
                <option key={n} value={n} disabled={n < picked.length}>{n}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Budget ($)
            <input className={`${input} tabular-nums`} inputMode="decimal" value={budget} onChange={(e) => changed(setBudget)(e.target.value)} disabled={busy} required />
          </label>
          <label className={label}>
            Max minutes
            <input className={`${input} tabular-nums`} type="number" min={5} step={5} value={maxMinutes} onChange={(e) => changed(setMaxMinutes)(Number(e.target.value))} disabled={busy} required />
          </label>
        </div>
      </Group>

      <Group
        n={2}
        title="Your dishes"
        note={picked.length
          ? picked.length >= dinners
            ? `${picked.length} picked, one for every dinner.`
            : `${picked.length} picked. Bao fills the other ${dinners - picked.length} ${dinners - picked.length === 1 ? "dinner" : "dinners"}.`
          : "Tap plates in the fridge or + on a recipe and they land here. Or let Bao choose."}
      >
        {picks.length > 0 && (
          <ul className="flex flex-wrap gap-2.5">
            {picks.map((p) => (
              <li key={p.id} className="pop-in flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-1.5">
                <DishArt id={p.id} title={p.title} frame="plate" className="h-10 w-10 shrink-0 rounded-full" />
                <Link href={`/recipes/${p.id}`} className="max-w-[12rem] truncate text-[15px] font-medium hover:underline">{p.title}</Link>
                <button
                  type="button"
                  onClick={() => changed(planPicks.remove)(p.id)}
                  disabled={busy}
                  aria-label={`Take ${p.title} out of the plan`}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-foreground"
                >
                  <X size={16} weight="bold" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={`flex flex-wrap gap-2 ${picks.length ? "mt-4" : ""}`}>
          <Link href="/fridge" className={btnSecondarySm}>Pick from the fridge</Link>
          <Link href="/recipes" className={btnSecondarySm}>Browse recipes</Link>
        </div>
        {picks.length === 0 && (
          <button
            type="button"
            onClick={() => submit()}
            disabled={busy}
            className="mt-5 flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-line-strong bg-surface/60 px-4 py-4 text-left transition hover:border-foreground/40 active:scale-[0.99] disabled:opacity-45"
          >
            <span aria-hidden className="shape-dough flex h-12 w-12 shrink-0 items-center justify-center bg-crust-tint text-crust-ink">
              <Shuffle size={22} weight="bold" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-semibold">Whatever&apos;s good</span>
              <span className="block text-sm text-muted">Bao picks all {dinners} dinners within {budget ? `$${budget}` : "your budget"} and {maxMinutes} minutes each.</span>
            </span>
          </button>
        )}
      </Group>

      <Group n={3} title="Use up from your fridge" note="Optional. Every plan then includes these.">
        <div className="flex flex-col gap-3 text-sm">
          {data.fridgeItems.length === 0 ? (
            <p className="text-[15px] text-muted">
              Your fridge is empty in Cooky. <Link className={btnText} href="/receipts/new">Stock up from a receipt</Link> or{" "}
              <Link className={btnText} href="/fridge">add items</Link> and plans will start from what you have.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {fridgeShown.map((f) => (
                <label key={f.id} className={`relative cursor-pointer ${chip} ${mustUse.includes(f.id) ? chipOn : chipOff}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={mustUse.includes(f.id)}
                    disabled={busy}
                    onChange={(e) => changed(setMustUse)(e.target.checked ? [...mustUse, f.id] : mustUse.filter((x) => x !== f.id))}
                  />
                  {f.name} · {formatQty(f.qty, f.unit)}
                  {f.expiresOn && (
                    <span className={`inline-flex items-center gap-1.5 ${f.pastUseBy ? "font-medium" : "opacity-70"}`}>
                      {f.pastUseBy && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-past-ink" />}
                      · {f.pastUseBy ? "past typical use-by" : "use by"} {f.expiresOn}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
          {data.fridgeItems.length > FRIDGE_SHOWN && (
            <button type="button" onClick={() => setAllFridge((v) => !v)} className={`self-start text-[15px] ${btnText}`}>
              {allFridge ? "Show fewer" : `Show all ${data.fridgeItems.length} foods`}
            </button>
          )}
          {data.fridgeItems.length > 0 && <p className="text-sm text-muted">Use-by dates are a typical guide, not safety advice.</p>}
        </div>
      </Group>

      <Group n={4} title="Anything in mind?" note="Optional. Bao reads this when choosing.">
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Anything in mind</span>
          <textarea
            className={`${input} min-h-24`}
            maxLength={limits.wishesMaxChars}
            placeholder="e.g. something light midweek, one vegetarian night"
            value={wishes}
            onChange={(e) => changed(setWishes)(e.target.value)}
            disabled={busy}
          />
        </label>
      </Group>

      {error && (
        <div role="alert" className={alert}>
          <p>{error.message}</p>
          <div className="mt-2 flex gap-3">
            {error.retry && (
              <button type="button" onClick={() => submit()} disabled={busy} className={btnText}>
                Try again
              </button>
            )}
            {error.upgrade && <Link className={btnText} href="/billing">Unlock Pro</Link>}
          </div>
        </div>
      )}

      {/* the submit bar stays in reach at the bottom of the screen while you fill the form */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-line bg-surface/95 p-3 shadow-float backdrop-blur-md sm:bottom-4 sm:p-4">
        {busy && (
          <BaoSays mood="thinking" pose="think" motion="breathe" size={48} className="mb-3">
            Weighing {data.recipes.length} dinners against your fridge and {budget ? `$${budget}` : "the budget"}. A few seconds.
          </BaoSays>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!busy && <span className="order-2 text-center text-sm text-muted sm:order-1 sm:text-left">Up to {budget ? `$${budget}` : "your budget"}, {maxMinutes} minutes each</span>}
          <button disabled={busy} className={`order-1 w-full sm:order-2 sm:ml-auto sm:w-auto ${btnPrimary}`}>
            {busy ? "Planning…" : `Plan ${dinners} dinners for ${servings}`}
          </button>
        </div>
      </div>
    </form>
  );
}
