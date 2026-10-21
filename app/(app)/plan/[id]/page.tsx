// Owner: Plan & Shop. One plan (PLN6, PLN8): meals with reasons, the package-sized shopping list, save.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { PlanDraft } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import { formatUsd } from "@/platform/money";
import { getPlan, planNotes } from "@/modules/planning";
import { formatQty } from "../ui";
import { SaveButton } from "./SaveButton";

export default async function PlanIdPage(props: PageProps<"/plan/[id]">) {
  const { id } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let plan: PlanDraft;
  try {
    plan = await getPlan(user.id, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const notes = await planNotes(user.id, plan);
  const over = plan.totalCents > plan.budgetCents;
  const unpriced = plan.shopping.unpricedIngredientIds.length;
  const toBuy = plan.shopping.items.filter((i) => i.packages > 0 || i.costCents === null);
  const covered = plan.shopping.items.filter((i) => i.packages === 0 && i.costCents !== null);
  const titles = new Map(plan.meals.map((m) => [m.recipeId, m.title]));

  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <Link href="/plan" className="text-sm text-zinc-500 hover:underline">← Plans</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {plan.meals.length} dinners for {plan.servings}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Version {plan.version} · prices as of {plan.priceAsOf}
          </p>
        </div>
        {plan.status === "saved" ? (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">Saved</span>
        ) : (
          <SaveButton planId={plan.planId} version={plan.version} />
        )}
      </div>

      <div className="mt-6 grid gap-3">
        {plan.meals.map((m, i) => (
          <article key={m.recipeId} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">
                <span className="mr-2 text-zinc-400">{i + 1}.</span>
                <Link href={`/recipes/${m.recipeId}`} className="hover:underline">{m.title}</Link>
              </h2>
              {m.usesFridgeItemIds.length > 0 && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  uses {m.usesFridgeItemIds.length} from your fridge
                </span>
              )}
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              {m.reasons.map((r, j) => <li key={j}>{r}</li>)}
            </ul>
            {notes.pastUseBy.filter((p) => p.recipeIds.includes(m.recipeId)).map((p) => (
              <p key={p.itemId} role="note" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Uses your {p.name}, which is past its typical use-by date ({p.expiresOn}). Check it before cooking; dates are a typical guide, not safety advice.
              </p>
            ))}
          </article>
        ))}
      </div>

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Shopping list</h2>
        <p className={`text-sm ${over ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}`}>
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formatUsd(plan.totalCents)}</span> of {formatUsd(plan.budgetCents)} budget
          {unpriced > 0 && ` · ${unpriced} item${unpriced > 1 ? "s" : ""} without a price`}
        </p>
      </div>

      {toBuy.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Nothing to buy: your fridge and staples cover every meal.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Buy</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="hidden px-3 py-2 sm:table-cell">Need / have</th>
                <th className="hidden px-3 py-2 sm:table-cell">Left over</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {toBuy.map((i) => (
                <tr key={`${i.ingredientId}|${i.unit}`}>
                  <td className="px-3 py-2">
                    {i.name}
                    <div className="text-xs text-zinc-500">{i.forRecipeIds.map((r) => titles.get(r) ?? r).join(", ")}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {i.packageSize !== null ? `${i.packages} × ${formatQty(i.packageSize, i.unit)}` : formatQty(i.buyQty, i.unit)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatUsd(i.costCents)}</td>
                  <td className="hidden px-3 py-2 text-zinc-500 sm:table-cell">{formatQty(i.needQty, i.unit)} / {formatQty(i.haveQty, i.unit)}</td>
                  <td className="hidden px-3 py-2 text-zinc-500 sm:table-cell">{formatQty(i.leftoverQty, i.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {covered.length > 0 && (
        <p className="mt-3 text-sm text-zinc-500">
          Already covered by your fridge or staples: {covered.map((i) => `${i.name} (${formatQty(i.needQty, i.unit)})`).join(", ")}.
        </p>
      )}

      {notes.extras.items.length > 0 && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="shrink-0 text-lg font-semibold">Optional extras</h2>
            <p className="text-sm text-zinc-500">
              Not in the total{notes.extras.totalCents > 0 && ` · +${formatUsd(notes.extras.totalCents)} if you add them all`}
              {notes.extras.unpricedIngredientIds.length > 0 && " (some prices unknown)"}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {notes.extras.items.map((i) => (
              <li key={`${i.ingredientId}|${i.unit}`} className="flex items-center justify-between gap-4 px-3 py-2">
                <span>
                  {i.name} <span className="text-zinc-500">· {formatQty(i.needQty, i.unit)} for {i.forRecipeIds.map((r) => titles.get(r) ?? r).join(", ")}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  {i.buyQty === 0 ? "already covered" : i.packageSize !== null ? `${i.packages} × ${formatQty(i.packageSize, i.unit)} · ${formatUsd(i.costCents)}` : formatUsd(i.costCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.assumptions.length > 0 && (
        <div className="mt-6 text-xs text-zinc-500">
          <p className="font-medium uppercase tracking-wide">Assumptions</p>
          <ul className="mt-1 list-disc pl-5">
            {plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
