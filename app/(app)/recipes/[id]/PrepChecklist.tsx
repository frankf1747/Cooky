"use client";
// Owner: Recipes & Cook. Ingredients as a tap-to-tick prep list (kept only on this screen).
import { useState } from "react";
import type { Recipe } from "@spec/contract";
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
      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-green-600 transition-all duration-300" style={{ width: `${required ? (ticked / required) * 100 : 0}%` }} />
        </div>
        <span aria-live="polite">{ticked === required && required > 0 ? "All set! 🙌" : `${ticked}/${required} ready`}</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {ingredients.map((i) => {
          const on = done.has(i.ingredientId);
          return (
            <li key={i.ingredientId}>
              <button
                onClick={() => toggle(i.ingredientId)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] ${on ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "border-zinc-200 bg-white hover:border-green-400 dark:border-zinc-800 dark:bg-zinc-900"}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${on ? "border-green-600 bg-green-600 text-white" : "border-zinc-300"}`}>{on ? "✓" : ""}</span>
                <span className={`flex-1 ${on ? "text-zinc-400 line-through" : ""}`}>
                  {i.name}
                  {i.optional && <span className="ml-2 rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-500 no-underline dark:bg-zinc-800">optional</span>}
                  {i.note && <span className="block text-xs text-zinc-500">{i.note}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">{formatQty(i.qty, i.unit)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
