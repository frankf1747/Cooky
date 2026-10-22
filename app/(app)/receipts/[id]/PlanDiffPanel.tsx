// Owner: Receipts. The plan diff (RCT5): what the linked plan said to buy that this receipt lacks,
// and what was bought that the plan does not use. Read-only; nothing here changes the fridge.
import Link from "next/link";
import type { z } from "zod";
import type { PlanDiff, ReceiptLine } from "@spec/contract";
import type { PlanLabels } from "@/modules/receipts";
import { h3, linkQuiet, panel } from "@/ui/styles";

export function PlanDiffPanel({ diff, plan, lines }: { diff: z.infer<typeof PlanDiff>; plan: PlanLabels; lines: ReceiptLine[] }) {
  const bought = new Map(lines.filter((l) => l.ingredientId).map((l) => [l.ingredientId as string, l.name]));
  const recipes = (ids: string[]) => ids.map((id) => plan.recipeTitles[id] ?? "a planned meal").join(", ");

  return (
    <section aria-labelledby="plan-diff-title" className={`mb-8 p-5 ${panel}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-diff-title" className={h3}>Compared with your plan</h2>
        <Link href={`/plan/${plan.planId}`} className={`text-sm ${linkQuiet}`}>Open the plan</Link>
      </div>

      {diff.missing.length === 0 && diff.extra.length === 0 && (
        <p className="mt-2 text-[15px] text-muted">Everything on your plan&apos;s shopping list is on this receipt.</p>
      )}

      {diff.missing.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-tomato-ink">On your list but not on this receipt</p>
          <ul className="mt-1.5 grid gap-1 text-[15px]">
            {diff.missing.map((m) => (
              <li key={m.ingredientId}>
                <span className="font-medium">{plan.ingredientNames[m.ingredientId] ?? m.ingredientId}</span>
                <span className="text-muted">: for {recipes(m.forRecipeIds)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.extra.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Bought, not in your plan</p>
          <p className="mt-1.5 text-[15px] text-muted">{diff.extra.map((id) => bought.get(id) ?? id).join(", ")}</p>
        </div>
      )}
    </section>
  );
}
