"use client";
// Owner: Recipes & Cook. Ingredients as a tick-off prep list (kept only on this screen).
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
      <p className="mt-1 text-xs text-zinc-500" aria-live="polite">{ticked} of {required} ready</p>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {ingredients.map((i) => {
          const on = done.has(i.ingredientId);
          return (
            <li key={i.ingredientId}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <input type="checkbox" checked={on} onChange={() => toggle(i.ingredientId)} className="size-4" />
                <span className={`flex-1 ${on ? "text-zinc-400 line-through" : ""}`}>
                  {i.name}
                  {i.optional && <span className="ml-2 text-xs text-zinc-500">(optional)</span>}
                  {i.note && <span className="block text-xs text-zinc-500">{i.note}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{formatQty(i.qty, i.unit)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
