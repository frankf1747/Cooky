"use client";
// Owner: Plan & Shop. Tick items in the store; each tick is saved on the plan so it follows you
// across devices (PATCH /api/plans/{id}/checklist). A failed save puts the tick back and says so.
// Bao keeps score in the sticky bar and cheers when the cart is full.
import Link from "next/link";
import { useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import type { ShoppingItem } from "@spec/contract";
import { formatUsd } from "@/platform/money";
import { Bao, BaoSays } from "@/ui/Bao";
import { alert, btnText, panel } from "@/ui/styles";
import { formatQty } from "../../plan/ui";

type Props = {
  planId: string;
  version: number;
  aisles: { category: string; items: ShoppingItem[] }[];
  initialChecked: string[];
  covered: ShoppingItem[];
  titles: Record<string, string>;
  totalCents: number;
  priceAsOf: string;
};

const AISLE_LABEL: Record<string, string> = {
  produce: "Produce", bakery: "Bakery", meat: "Meat", seafood: "Seafood", dairy: "Dairy", eggs: "Eggs",
  frozen: "Frozen", pantry: "Pantry", prepared: "Prepared", snacks: "Snacks", beverages: "Drinks", other: "Other",
};

export function ShopList({ planId, aisles, initialChecked, covered, titles, totalCents, priceAsOf }: Props) {
  const [checked, setChecked] = useState<string[]>(initialChecked);
  const [saving, setSaving] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const items = aisles.flatMap((a) => a.items);
  const inCart = items.filter((i) => checked.includes(i.ingredientId));
  const leftCents = items.filter((i) => !checked.includes(i.ingredientId)).reduce((s, i) => s + (i.costCents ?? 0), 0);
  const unknownLeft = items.some((i) => !checked.includes(i.ingredientId) && i.costCents === null);
  const done = items.length > 0 && inCart.length === items.length;
  const progress = items.length ? Math.round((inCart.length / items.length) * 100) : 0;

  // Saves go one at a time, in tap order: the server updates the whole list per request, so two
  // saves in flight at once would overwrite each other and lose a tick. The tick shows at once.
  const queue = useRef<Promise<void>>(Promise.resolve());

  function toggle(id: string, on: boolean) {
    if (saving.includes(id)) return;
    setError(null);
    setSaving((s) => [...s, id]);
    setChecked((c) => (on ? [...new Set([...c, id])] : c.filter((x) => x !== id)));
    queue.current = queue.current.then(async () => {
      try {
        const res = await fetch(`/api/plans/${planId}/checklist`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ingredientId: id, checked: on }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setChecked((c) => (on ? c.filter((x) => x !== id) : [...new Set([...c, id])]));
        setError("That tick didn't save. Check your connection and tap it again.");
      } finally {
        setSaving((s) => s.filter((x) => x !== id));
      }
    });
  }

  if (items.length === 0) {
    return (
      <BaoSays mood="proud" pose="hold" prop="basket" className="mt-6">
        Nothing to buy. Your fridge and staples cover every meal. <Link href={`/plan/${planId}`} className={btnText}>Back to the plan</Link>
      </BaoSays>
    );
  }

  return (
    <>
      <div className="sticky top-14 z-10 -mx-4 border-b border-zinc-200 bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Bao key={done ? "done" : "going"} mood={done ? "cheer" : "happy"} pose="hold" prop="basket" motion={done ? "wiggle" : "none"} size={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p><span className="font-display text-lg font-semibold">{inCart.length} of {items.length}</span> in the cart</p>
              <p className="text-zinc-600 dark:text-zinc-400" aria-live="polite">
                {done ? "All in. Bao approves." : <>About <span className="font-semibold text-foreground">{formatUsd(leftCents)}</span> to go{unknownLeft && ", plus unpriced items"}</>}
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Items in the cart">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
      {error && <p role="alert" className={`mt-3 ${alert}`}>{error}</p>}

      {aisles.map((a) => (
        <div key={a.category} className="mt-6">
          <h2 className="font-display text-base font-semibold tracking-tight">{AISLE_LABEL[a.category] ?? a.category}</h2>
          <ul className={`mt-2 divide-y divide-zinc-200 dark:divide-zinc-800 ${panel}`}>
            {a.items.map((i) => {
              const on = checked.includes(i.ingredientId);
              const busy = saving.includes(i.ingredientId);
              return (
                <li key={`${i.ingredientId}|${i.unit}`}>
                  <label className={`flex cursor-pointer items-center gap-3 px-3 py-3 transition active:bg-zinc-50 dark:active:bg-zinc-800/50 ${busy ? "opacity-70" : ""}`}>
                    <input type="checkbox" className="sr-only" checked={on} disabled={busy} onChange={(e) => toggle(i.ingredientId, e.target.checked)} />
                    <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${on ? "tick-pop border-accent bg-accent text-on-accent" : "border-zinc-400 dark:border-zinc-600"}`}>
                      {on && <Check size={16} weight="bold" />}
                    </span>
                    <span className={`min-w-0 flex-1 transition ${on ? "text-zinc-500" : ""}`}>
                      <span className="relative inline-block">
                        {i.name}
                        <span aria-hidden className="absolute left-0 top-1/2 h-[2px] w-full origin-left bg-current transition-transform duration-300" style={{ transform: on ? "scaleX(1)" : "scaleX(0)" }} />
                      </span>
                      <span className="block text-xs text-zinc-500">for {i.forRecipeIds.map((r) => titles[r] ?? r).join(", ")}</span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap text-right text-sm ${on ? "text-zinc-500" : ""}`}>
                      {i.packageSize !== null ? `${i.packages} × ${formatQty(i.packageSize, i.unit)}` : formatQty(i.buyQty, i.unit)}
                      <span className="block text-xs text-zinc-500">{formatUsd(i.costCents)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {covered.length > 0 && (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Already at home (fridge or staples): {covered.map((i) => i.name).join(", ")}.
        </p>
      )}
      <p className="mt-4 text-xs text-zinc-500">
        Prices are typical package prices checked on {priceAsOf}; taxes are not included. Plan total {formatUsd(totalCents)}. When you&apos;re home,{" "}
        <Link href="/receipts/new" className={btnText}>scan the receipt</Link> and Bao stocks the fridge.
      </p>
    </>
  );
}
