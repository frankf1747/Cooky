// Owner: Plan & Shop. Small helpers shared by the plan pages (safe on server and client).

export function formatQty(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? String(qty) : qty.toFixed(qty < 10 ? 2 : 1).replace(/\.?0+$/, "");
  return unit === "count" ? n : `${n} ${unit}`;
}

const RELAX: Record<string, string> = {
  budgetCents: "raise the budget",
  meals: "plan fewer meals",
  maxMinutes: "allow more minutes per meal",
  mustUseItemIds: "un-pin a fridge item",
  mustIncludeRecipeIds: "un-pick a dish",
  excludedIngredients: "remove an excluded ingredient in Settings",
  allergens: "review your allergen filters in Settings",
  equipment: "add equipment in Settings",
  preferences: "review your hard preferences",
};

export type ApiErrorBody = { error?: string; code?: string; status?: number; cheapestFeasibleCents?: number | null; relax?: string[]; resetAt?: string };

/** One honest sentence for each error the plan routes can return (SPEC §8). */
export function planErrorMessage(status: number, body: ApiErrorBody, usd: (c: number) => string): { message: string; retry: boolean; upgrade?: boolean } {
  switch (body.code) {
    case "infeasible": {
      const hints = (body.relax ?? []).map((h) => RELAX[h] ?? h);
      const cheapest = body.cheapestFeasibleCents != null ? ` The cheapest plan that meets your other choices costs ${usd(body.cheapestFeasibleCents)}.` : "";
      return { message: `No plan fits these choices.${cheapest}${hints.length ? ` Try to ${hints.join(", or ")}.` : ""}`, retry: false };
    }
    case "not_pro":
      return { message: "You've used your free plan. Unlock Cooky Pro to make more.", retry: false, upgrade: true };
    case "quota_exhausted":
      return { message: `You've reached your plan limit for now${body.resetAt ? `; it resets ${new Date(body.resetAt).toLocaleString()}` : ""}.`, retry: false };
    case "ai_paused":
      return { message: "Planning is paused for today because Cooky's daily AI budget is used up. Please try again tomorrow.", retry: false };
    case "no_alternative":
      return { message: "No other dish fits this plan's budget, time and preferences, so the plan is unchanged. Try a bigger budget or more minutes in a new plan.", retry: false };
    case "plan_invalid":
      return { message: "The planner couldn't produce a valid plan this time. Nothing was saved.", retry: true };
    case "stale_version":
      return { message: "This plan changed since you opened it (maybe in another tab). Reload to see the latest version.", retry: false };
    case "not_found":
      return { message: "That plan or fridge item no longer exists.", retry: false };
    default:
      return { message: body.error ? `${body.error}.` : `Request failed (${status}).`, retry: status >= 500 || status === 0 };
  }
}
