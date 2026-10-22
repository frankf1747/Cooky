"use client";
// Owner: Plan & Shop. The plan request form (PLN1). Posts to /api/plans and opens the draft.
// Dishes are picked elsewhere, by tapping plates in the fridge or + on a recipe (src/ui/planPicks);
// here they are listed, can be taken out, and go in as `mustIncludeRecipeIds`. "Whatever's good"
// plans without any picks: Bao chooses every dish within the budget and time above.
// The basics are set with − and + steppers and a row of times, never typed or picked from a list.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CurrencyDollar, ForkKnife, Shuffle, Timer, Users, X } from "@phosphor-icons/react";
import { formatUsd } from "@/platform/money";
import type { PlanFormData } from "@/modules/planning";
import { BaoSays } from "@/ui/Bao";
import { BUDGET_MAX_CENTS, BUDGET_MIN_CENTS, BUDGET_STEP_CENTS, minuteChoices as timesFor, usd } from "@/ui/basics";
import { DishArt } from "@/ui/DishArt";
import { Stepper } from "@/ui/Stepper";
import { planPicks, usePlanPicks } from "@/ui/planPicks";
import { alert, btnPrimary, btnSecondarySm, btnText, chip, chipOff, chipOn, chipRow, field as input, h2 } from "@/ui/styles";
import { formatQty, planErrorMessage, type ApiErrorBody } from "./ui";

type Limits = { servingsMin: number; servingsMax: number; mealsMin: number; mealsMax: number; wishesMaxChars: number };

/** How many fridge foods show before "Show all". */
const FRIDGE_SHOWN = 6;

/** One numbered part of the form: a Fraunces heading with its step number, a note, the fields. */
function Group({ n, title, note, children }: { n: number; title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 border-t border-line pt-8 first:border-t-0 first:pt-0">
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
  const [budgetCents, setBudgetCents] = useState(d.budgetCents);
  const budget = usd(budgetCents);
  const [maxMinutes, setMaxMinutes] = useState(d.maxMinutes);
  // Picks live in the browser and follow the person around; only dishes still in the library count.
  const picks = usePlanPicks().filter((p) => data.recipes.some((r) => r.id === p.id));
  const picked = picks.map((p) => p.id);
  const [meals, setMeals] = useState(Math.min(limits.mealsMax, Math.max(d.meals, preselected.length)));
  // Never fewer dishes than picked ones.
  const dishes = Math.min(limits.mealsMax, Math.max(meals, picked.length));
  const minuteChoices = timesFor(d.maxMinutes);
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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          servings, budgetCents, maxMinutes, meals: dishes,
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stepper
            label="People"
            icon={<Users size={16} weight="bold" />}
            value={servings}
            min={limits.servingsMin}
            max={limits.servingsMax}
            unit={servings === 1 ? "person" : "people"}
            less="Fewer people"
            more="More people"
            onChange={changed(setServings)}
            disabled={busy}
          />
          <Stepper
            label="Dishes"
            icon={<ForkKnife size={16} weight="bold" />}
            value={dishes}
            min={limits.mealsMin}
            max={limits.mealsMax}
            unit={dishes === 1 ? "dish" : "dishes"}
            less="Fewer dishes"
            more="More dishes"
            onChange={changed(setMeals)}
            disabled={busy}
            floor={{ value: picked.length, note: `You picked ${picked.length}` }}
          />
          <div className="col-span-2 sm:col-span-1">
            <Stepper
              label="Budget"
              icon={<CurrencyDollar size={16} weight="bold" />}
              value={budgetCents}
              min={BUDGET_MIN_CENTS}
              max={BUDGET_MAX_CENTS}
              step={BUDGET_STEP_CENTS}
              format={usd}
              unit="for the week"
              less="Lower the budget by $5"
              more="Raise the budget by $5"
              onChange={changed(setBudgetCents)}
              disabled={busy}
            />
          </div>
        </div>
        <div role="radiogroup" aria-label="Most minutes per dish" className="mt-5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <Timer size={16} weight="bold" aria-hidden className="text-subtle" />
            Time per dish, at most
          </p>
          <div className={`mt-2 ${chipRow}`}>
            {minuteChoices.map((m) => (
              <label key={m} className={`relative cursor-pointer ${chip} ${maxMinutes === m ? chipOn : chipOff} tabular-nums`}>
                <input type="radio" name="maxMinutes" className="sr-only" checked={maxMinutes === m} onChange={() => changed(setMaxMinutes)(m)} disabled={busy} />
                {m} min
              </label>
            ))}
          </div>
        </div>
      </Group>

      <Group
        n={2}
        title="Your dishes"
        note={picked.length
          ? picked.length >= dishes
            ? `${picked.length} picked, one for every dish.`
            : `${picked.length} picked. Bao fills the other ${dishes - picked.length} ${dishes - picked.length === 1 ? "dish" : "dishes"}.`
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
              <span className="block text-sm text-muted">Bao picks all {dishes} dishes within {budget} and {maxMinutes} minutes each.</span>
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
            Weighing {data.recipes.length} dishes against your fridge and {budget}. A few seconds.
          </BaoSays>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!busy && <span className="order-2 text-center text-sm text-muted sm:order-1 sm:text-left">Up to {budget}, {maxMinutes} minutes each</span>}
          <button disabled={busy} className={`order-1 w-full sm:order-2 sm:ml-auto sm:w-auto ${btnPrimary}`}>
            {busy ? "Planning…" : `Plan ${dishes} dishes for ${servings}`}
          </button>
        </div>
      </div>
    </form>
  );
}
