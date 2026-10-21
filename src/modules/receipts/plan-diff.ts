// The plan diff (SPEC RCT5): what the linked plan said to buy that is not on the receipt, and
// what was bought that the plan does not use. Pure code over catalog ids; generic items have no
// id and plans ignore them (RCT10), so they never appear here.
import type { z } from "zod";
import type { PlanDiff, ReceiptLine, ShoppingList } from "@spec/contract";

export function planDiff(lines: ReceiptLine[], shopping: ShoppingList): z.infer<typeof PlanDiff> {
  const bought = new Set(
    lines.filter((l) => l.kind === "food" && l.decision !== "ignored" && l.ingredientId).map((l) => l.ingredientId as string),
  );
  const inPlan = new Set(shopping.items.map((i) => i.ingredientId));
  return {
    // Only what the plan said to buy; an item the fridge already covers was never on the list.
    missing: shopping.items
      .filter((i) => i.buyQty > 0 && !bought.has(i.ingredientId))
      .map((i) => ({ ingredientId: i.ingredientId, forRecipeIds: i.forRecipeIds })),
    extra: [...bought].filter((id) => !inPlan.has(id)),
  };
}
