"use client";
// Owner: Recipes & Cook. Ingredients as a tap-to-tick prep list (kept only on this screen).
import { useState } from "react";
import type { Recipe } from "@spec/contract";
import { ui } from "../fun";
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
      <div className={`mt-3 flex items-center gap-3 text-xs ${ui.muted}`}>
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-[#34374A] bg-white">
          <div className="h-full bg-[#FFB7C5] transition-all duration-300" style={{ width: `${required ? (ticked / required) * 100 : 0}%` }} />
        </div>
        <span aria-live="polite" className="font-bold">{ticked === required && required > 0 ? "All set! 🙌" : `${ticked}/${required} ready`}</span>
      </div>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {ingredients.map((i) => {
          const on = done.has(i.ingredientId);
          return (
            <li key={i.ingredientId}>
              <button
                onClick={() => toggle(i.ingredientId)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition active:scale-[0.98] ${ui.wobbleSm} ${on ? "border-2 border-[#A8D8EA] bg-[#EAF6FB]" : "border-2 border-[#34374A]/20 bg-white hover:border-[#6C8EBF]"}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${on ? "border-[#34374A] bg-[#6C8EBF] text-white" : "border-[#34374A]/40"}`}>{on ? "✓" : ""}</span>
                <span className={`flex-1 ${on ? "text-[#9A9DB0] line-through" : ""}`}>
                  {i.name}
                  {i.optional && <span className={`ml-2 rounded-full px-1.5 text-xs ${ui.tag}`}>optional</span>}
                  {i.note && <span className={`block text-xs ${ui.muted}`}>{i.note}</span>}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{formatQty(i.qty, i.unit)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
