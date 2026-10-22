"use client";
// Owner: Platform. Putting a dish in (or out of) the next plan, from anywhere a dish appears, and
// the floating reminder of how many are picked. See ./planPicks.ts.
import Link from "next/link";
import { ArrowRight, Check, Plus } from "@phosphor-icons/react";
import { PICKS_MAX, planPicks, usePlanPicks, type PlanPick } from "./planPicks";
import { btnPrimary, btnSecondary } from "./styles";

/** A round + on a recipe card, or a full button on a recipe page. */
export function PlanPickButton({ dish, variant = "icon", className = "" }: { dish: PlanPick; variant?: "icon" | "full"; className?: string }) {
  const picks = usePlanPicks();
  const on = picks.some((p) => p.id === dish.id);
  const full = !on && picks.length >= PICKS_MAX;
  const label = on ? `Take ${dish.title} out of your plan` : full ? `Your plan already has ${PICKS_MAX} dishes` : `Add ${dish.title} to your plan`;
  if (variant === "full") {
    return (
      <button type="button" onClick={() => planPicks.toggle(dish)} disabled={full} aria-pressed={on} className={`${on ? btnPrimary : btnSecondary} ${className}`}>
        {on ? <Check size={18} weight="bold" aria-hidden className="tick-pop" /> : <Plus size={18} weight="bold" aria-hidden />}
        {on ? "In your plan" : full ? "Plan is full" : "Add to plan"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => planPicks.toggle(dish)}
      disabled={full}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-float transition active:scale-95 disabled:opacity-45 ${on ? "bg-accent text-on-accent" : "bg-surface/95 text-foreground hover:scale-105"} ${className}`}
    >
      {on ? <Check size={18} weight="bold" aria-hidden className="tick-pop" /> : <Plus size={18} weight="bold" aria-hidden />}
    </button>
  );
}

/** Floats above the tab bar once something is picked: how many, and the way to the plan. */
export function PlanPicksBar() {
  const picks = usePlanPicks();
  if (picks.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 sm:bottom-8">
      <Link
        href="/plan"
        className="pop-in pointer-events-auto flex h-14 items-center gap-3 rounded-full bg-foreground pl-2 pr-5 text-background shadow-float transition active:scale-[0.97]"
      >
        <span className="flex h-10 min-w-10 items-center justify-center rounded-full bg-accent px-2 font-display text-lg font-semibold text-on-accent tabular-nums">{picks.length}</span>
        <span className="text-[15px] font-medium">
          {picks.length === 1 ? "dish" : "dishes"} in your plan
        </span>
        <span className="flex items-center gap-1 text-[15px] font-semibold">
          Plan <ArrowRight size={16} weight="bold" aria-hidden />
        </span>
      </Link>
    </div>
  );
}
