// Owner: Recipes & Cook. Small helpers shared by the recipe and cook pages (safe on server and client).

/** "400 g", "1.5 ml", "3" for counts; trims trailing zeros. */
export function formatQty(qty: number, unit: string): string {
  const rounded = Math.round(qty * 100) / 100;
  const n = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(rounded < 10 ? 2 : 1).replace(/\.?0+$/, "");
  return unit === "count" ? n : `${n} ${unit}`;
}

/** Recipe amount for `servings` people, from the amount for `baseServings` (CK1). */
export function scaled(qty: number, baseServings: number, servings: number): number {
  return (qty * servings) / baseServings;
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type ApiErrorBody = { error?: string; code?: string; status?: number; resetAt?: string; shortfall?: number };

/** One honest sentence for each error the cook and recipe routes can return (SPEC §8). */
export function cookErrorMessage(status: number, body: ApiErrorBody): { message: string; retry: boolean; upgrade?: boolean } {
  switch (body.code) {
    case "not_pro":
      return { message: "The cooking assistant is a Cooky Pro feature.", retry: false, upgrade: true };
    case "quota_exhausted":
      return { message: `You've reached today's limit for questions${body.resetAt ? `; it resets ${new Date(body.resetAt).toLocaleString()}` : ""}.`, retry: false };
    case "ai_paused":
      return { message: "The assistant is paused for today because Cooky's daily AI budget is used up. The recipe steps still work.", retry: false };
    case "ai_refused":
      return { message: "The assistant declined that question. Try asking about this recipe's steps or ingredients.", retry: false };
    case "insufficient_stock":
      return { message: "Your fridge has less of an item than this says. Lower that amount and confirm again.", retry: false };
    case "not_found":
      return { message: "This recipe or cooking session no longer exists. Reload the page.", retry: false };
    case "invalid_input":
      return { message: body.error && body.error !== "Invalid input" ? body.error : "Something in the form isn't valid. Check the amounts and try again.", retry: false };
    default:
      if (status === 401) return { message: "Your session ended. Sign in again.", retry: false };
      return { message: "Something went wrong on our side. Nothing was changed. Please try again.", retry: true };
  }
}

/** One honest sentence for each error adding a recipe can return (SPEC §8, RCP5–RCP7). */
export function importErrorMessage(status: number, body: ApiErrorBody): { message: string; retry: boolean; upgrade?: boolean } {
  switch (body.code) {
    case "not_pro":
      return { message: "Writing recipes is a Cooky Pro feature.", retry: false, upgrade: true };
    case "quota_exhausted":
      return { message: `You've added today's recipes${body.resetAt ? `; more from ${new Date(body.resetAt).toLocaleString()}` : ""}.`, retry: false };
    case "ai_paused":
      return { message: "Bao is resting for today because Cooky's daily AI budget is used up. The library still works.", retry: false };
    case "ai_refused":
      return { message: "Bao won't write that one. Try describing a dish you'd like to cook.", retry: false };
    case "not_a_recipe":
      return { message: "That doesn't read as a dish to cook. Try something like \"a cozy soup with white beans\".", retry: false };
    case "invalid_input":
      return { message: body.error && body.error !== "Invalid input" ? body.error : "Something in the recipe isn't valid yet. Check the flagged rows.", retry: false };
    default:
      if (status === 401) return { message: "Your session ended. Sign in again.", retry: false };
      return { message: "Bao couldn't finish that. Nothing was saved. Try again.", retry: true };
  }
}
