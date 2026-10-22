"use client";
// Owner: Platform. The dishes a person has picked for their next plan, from the fridge or the
// recipe library, before they ask for the plan. Kept in this browser (localStorage) so the count
// follows them from page to page and shows on the Plan tab. Nothing is saved on the server until
// the plan request, which sends these as `mustIncludeRecipeIds`; a successful plan clears them.
import { useSyncExternalStore } from "react";
import targets from "@spec/targets.json";

export type PlanPick = { id: string; title: string };

const KEY = "cooky.plan-picks";
/** A plan holds at most this many dinners, so at most this many picks. */
export const PICKS_MAX = targets.limits.mealsPerPlanMax;

const EMPTY: PlanPick[] = [];
const listeners = new Set<() => void>();
let cache: PlanPick[] | null = null;

function read(): PlanPick[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed)
      ? parsed.filter((p): p is PlanPick => typeof p?.id === "string" && typeof p?.title === "string").slice(0, PICKS_MAX)
      : [];
  } catch {
    // Private windows and blocked storage: picks still work for this page, they just don't persist.
    cache = [];
  }
  return cache;
}

function write(next: PlanPick[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // See read().
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const planPicks = {
  toggle(pick: PlanPick) {
    const now = read();
    if (now.some((p) => p.id === pick.id)) write(now.filter((p) => p.id !== pick.id));
    else if (now.length < PICKS_MAX) write([...now, pick]);
  },
  add(picks: PlanPick[]) {
    const now = read();
    write([...now, ...picks.filter((p) => !now.some((n) => n.id === p.id))].slice(0, PICKS_MAX));
  },
  remove(id: string) {
    write(read().filter((p) => p.id !== id));
  },
  clear() {
    write([]);
  },
};

/** The current picks, re-rendering when they change here or in another tab. */
export function usePlanPicks(): PlanPick[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
