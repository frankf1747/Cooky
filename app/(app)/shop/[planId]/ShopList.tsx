"use client";
// Owner: Plan & Shop. Tick items in the store; each tick is saved on the plan so it follows you
// across devices (PATCH /api/plans/{id}/checklist). A failed save puts the tick back and says so.
// Bao keeps score in the sticky bar and hops when the cart is full.
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, Check } from "@phosphor-icons/react";
import type { ShoppingItem } from "@spec/contract";
import { formatUsd } from "@/platform/money";
import { Bao } from "@/ui/Bao";
import { EmptyState, Kicker } from "@/ui/Page";
import { alert, btnSecondary, rows, tick, tickOff, tickOn, tones } from "@/ui/styles";
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
      <EmptyState
        mood="celebrating"
        pose="hold"
        prop="basket"
        title="Nothing to buy"
        action={<Link href={`/plan/${planId}`} className={btnSecondary}>Back to the plan</Link>}
      >
        Your fridge and staples cover every meal. Rare, and very satisfying.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="sticky top-14 z-10 -mx-4 border-b border-line bg-background/95 px-4 py-3 backdrop-blur-md sm:top-16 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-3">
          <Bao key={done ? "done" : "going"} mood={done ? "celebrating" : "welcoming"} pose="hold" prop="basket" motion={done ? "hop" : "none"} size={44} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p><span className="font-display text-xl font-semibold tabular-nums">{inCart.length} of {items.length}</span> <span className="text-muted">in the cart</span></p>
              <p className="text-muted" aria-live="polite">
                {done ? <span className="font-medium text-foreground">All in. Bao approves.</span> : <>About <span className="font-semibold text-foreground tabular-nums">{formatUsd(leftCents)}</span> to go{unknownLeft && ", plus unpriced items"}</>}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Items in the cart">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
      {error && <p role="alert" className={`mt-3 ${alert}`}>{error}</p>}

      {aisles.map((a) => (
        <section key={a.category} className="mt-8" aria-labelledby={`aisle-${a.category}`}>
          <h2 id={`aisle-${a.category}`} className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <span aria-hidden className="h-2 w-2 rounded-full bg-crust" />
            {AISLE_LABEL[a.category] ?? a.category}
            <span className="tabular-nums">· {a.items.filter((i) => checked.includes(i.ingredientId)).length}/{a.items.length}</span>
          </h2>
          <ul className={`mt-2.5 ${rows}`}>
            {a.items.map((i) => {
              const on = checked.includes(i.ingredientId);
              const busy = saving.includes(i.ingredientId);
              return (
                <li key={`${i.ingredientId}|${i.unit}`}>
                  <label className={`flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition active:bg-sunken/60 ${busy ? "opacity-70" : ""}`}>
                    <input type="checkbox" className="peer sr-only" checked={on} disabled={busy} onChange={(e) => toggle(i.ingredientId, e.target.checked)} />
                    <span aria-hidden className={`${tick} peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? tickOn : tickOff}`}>
                      {on && <Check size={16} weight="bold" />}
                    </span>
                    <span className={`min-w-0 flex-1 transition ${on ? "text-subtle" : ""}`}>
                      <span className="relative inline-block text-[15px] font-medium">
                        {i.name}
                        <span aria-hidden className="absolute left-0 top-1/2 h-[2px] w-full origin-left bg-current transition-transform duration-300" style={{ transform: on ? "scaleX(1)" : "scaleX(0)" }} />
                      </span>
                      <span className="block text-sm text-muted">for {i.forRecipeIds.map((r) => titles[r] ?? r).join(", ")}</span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap text-right text-[15px] tabular-nums ${on ? "text-subtle" : ""}`}>
                      {i.packageSize !== null ? `${i.packages} × ${formatQty(i.packageSize, i.unit)}` : formatQty(i.buyQty, i.unit)}
                      <span className="block text-sm text-muted">{formatUsd(i.costCents)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {covered.length > 0 && (
        <p className="mt-8 text-sm leading-relaxed text-muted">
          Already at home (fridge or staples): {covered.map((i) => i.name).join(", ")}.
        </p>
      )}
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Prices are typical package prices checked on {priceAsOf}; taxes are not included. Plan total <span className="tabular-nums">{formatUsd(totalCents)}</span>.
      </p>

      {/* the next step, as big as this one: home from the store, stock the fridge */}
      <Link href={`/receipts/new?planId=${planId}`} className={`group mt-8 flex items-center gap-4 rounded-[24px] p-5 transition active:scale-[0.99] sm:p-6 ${tones.scan.tint}`}>
        <span className="min-w-0 flex-1">
          <Kicker tone="scan" className="!text-foreground/70">Step 3 · Stock</Kicker>
          <span className="mt-2 block font-display text-2xl font-semibold leading-tight">Stock the fridge</span>
          <span className="mt-1 block text-[15px] text-foreground/75">Home from the store? Scan the receipt: prices get logged and the food goes in.</span>
        </span>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface transition group-hover:translate-x-0.5">
          <ArrowRight size={20} weight="bold" aria-hidden />
        </span>
      </Link>
    </>
  );
}
