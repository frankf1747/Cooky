"use client";
// Owner: Recipes & Cook. Ingredients as a tick-off prep list (kept only on this screen).
import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import type { Recipe } from "@spec/contract";
import { tick, tickOff, tickOn } from "@/ui/styles";
import { formatQty } from "../ui";

export function PrepChecklist({ ingredients }: { ingredients: Recipe["ingredients"] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const required = ingredients.filter((i) => !i.optional).length;
  const ticked = ingredients.filter((i) => !i.optional && done.has(i.ingredientId)).length;
  const toggle = (id: string) =>
    setDone((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="h-full rounded-full bg-basil transition-[width] duration-300" style={{ width: `${required ? (ticked / required) * 100 : 0}%` }} />
        </div>
        <p className="shrink-0 text-sm text-muted tabular-nums" aria-live="polite">{ticked} of {required} ready</p>
      </div>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {ingredients.map((i) => {
          const on = done.has(i.ingredientId);
          return (
            <li key={i.ingredientId}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2.5">
                <input type="checkbox" checked={on} onChange={() => toggle(i.ingredientId)} className="peer sr-only" />
                <span aria-hidden className={`${tick} peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? tickOn : tickOff}`}>
                  {on && <Check size={15} weight="bold" />}
                </span>
                <span className={`min-w-0 flex-1 text-[15px] transition ${on ? "text-subtle line-through" : ""}`}>
                  {i.name}
                  {i.optional && <span className="ml-2 text-xs text-muted">optional</span>}
                  {i.note && <span className="block text-sm text-muted">{i.note}</span>}
                </span>
                <span className={`shrink-0 text-[15px] tabular-nums ${on ? "text-subtle" : "font-medium"}`}>{formatQty(i.qty, i.unit)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
