// Owner: Receipts. The plan diff (RCT5): what the linked plan said to buy that this receipt lacks,
// and what was bought that the plan does not use. Read-only; nothing here changes the fridge.
import Link from "next/link";
import type { z } from "zod";
import type { PlanDiff, ReceiptLine } from "@spec/contract";
import type { PlanLabels } from "@/modules/receipts";

export function PlanDiffPanel({ diff, plan, lines }: { diff: z.infer<typeof PlanDiff>; plan: PlanLabels; lines: ReceiptLine[] }) {
  const bought = new Map(lines.filter((l) => l.ingredientId).map((l) => [l.ingredientId as string, l.name]));
  const recipes = (ids: string[]) => ids.map((id) => plan.recipeTitles[id] ?? "a planned meal").join(", ");

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Compared with your plan</h2>
        <Link href={`/plan/${plan.planId}`} className="text-sm text-zinc-500 hover:underline">Open the plan</Link>
      </div>

      {diff.missing.length === 0 && diff.extra.length === 0 && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Everything on your plan&apos;s shopping list is on this receipt.</p>
      )}

      {diff.missing.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">On your list but not on this receipt</p>
          <ul className="mt-1 grid gap-1 text-sm">
            {diff.missing.map((m) => (
              <li key={m.ingredientId}>
                <span className="font-medium">{plan.ingredientNames[m.ingredientId] ?? m.ingredientId}</span>
                <span className="text-zinc-500">: for {recipes(m.forRecipeIds)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.extra.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium">Bought, not in your plan</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{diff.extra.map((id) => bought.get(id) ?? id).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
