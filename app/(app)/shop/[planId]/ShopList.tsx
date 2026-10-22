"use client";
// Owner: Plan & Shop. Tick items in the store; each tick is saved on the plan so it follows you
// across devices (PATCH /api/plans/{id}/checklist). A failed save puts the tick back and says so.
import Link from "next/link";
import { useState } from "react";
import type { ShoppingItem } from "@spec/contract";
import { formatUsd } from "@/platform/money";
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

  async function toggle(id: string, on: boolean) {
    if (saving.includes(id)) return;
    setError(null);
    setSaving((s) => [...s, id]);
    setChecked((c) => (on ? [...c, id] : c.filter((x) => x !== id)));
    try {
      const res = await fetch(`/api/plans/${planId}/checklist`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingredientId: id, checked: on }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setChecked(((await res.json()) as { checked: string[] }).checked);
    } catch {
      setChecked((c) => (on ? c.filter((x) => x !== id) : [...c, id]));
      setError("That tick didn't save. Check your connection and tap it again.");
    } finally {
      setSaving((s) => s.filter((x) => x !== id));
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Nothing to buy: your fridge and staples cover every meal. <Link href={`/plan/${planId}`} className="underline">Back to the plan</Link>
      </p>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-10 mt-4 flex items-baseline justify-between gap-4 border-b border-zinc-200 bg-[var(--background)] py-3 dark:border-zinc-800">
        <p className="text-sm">
          <span className="font-semibold">{inCart.length} of {items.length}</span> in your cart
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {inCart.length === items.length ? "All done" : <>About <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatUsd(leftCents)}</span> left{unknownLeft && " + unpriced items"}</>}
          <span className="text-zinc-500"> · plan {formatUsd(totalCents)}</span>
        </p>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      {aisles.map((a) => (
        <div key={a.category} className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{AISLE_LABEL[a.category] ?? a.category}</h2>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {a.items.map((i) => {
              const on = checked.includes(i.ingredientId);
              return (
                <li key={`${i.ingredientId}|${i.unit}`}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                      checked={on}
                      disabled={saving.includes(i.ingredientId)}
                      onChange={(e) => toggle(i.ingredientId, e.target.checked)}
                    />
                    <span className={`min-w-0 flex-1 ${on ? "text-zinc-400 line-through" : ""}`}>
                      {i.name}
                      <span className="block text-xs text-zinc-500 no-underline">
                        for {i.forRecipeIds.map((r) => titles[r] ?? r).join(", ")}
                      </span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap text-right text-sm ${on ? "text-zinc-400" : ""}`}>
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
        <p className="mt-6 text-sm text-zinc-500">
          No need to buy (fridge or staples): {covered.map((i) => i.name).join(", ")}.
        </p>
      )}
      <p className="mt-4 text-xs text-zinc-500">
        Prices are typical package prices checked on {priceAsOf}; taxes are not included. When you&apos;re home,{" "}
        <Link href="/receipts/new" className="underline">scan the receipt</Link> to stock your fridge.
      </p>
    </>
  );
}
