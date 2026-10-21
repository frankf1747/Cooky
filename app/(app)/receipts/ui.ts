// Owner: Receipts. Helpers shared by the receipt pages (safe on server and client).
import type { Category, Location, ReceiptConfirm, ReceiptLine, Unit } from "@spec/contract";

export type ApiErrorBody = { error?: string; code?: string; status?: number; resetAt?: string };
export type ReceiptError = { message: string; retry: boolean; manualAdd?: boolean };

/** One honest sentence for each error the receipt routes can return (SPEC §8, RCT7). */
export function receiptErrorMessage(status: number, body: ApiErrorBody): ReceiptError {
  switch (body.code) {
    case "not_a_receipt":
      return { message: "That photo doesn't look like a shopping receipt. Try another photo, or add your groceries by hand.", retry: false, manualAdd: true };
    case "ai_refused":
      return { message: "Cooky couldn't read this receipt. Try a clearer photo, or add your groceries by hand.", retry: false, manualAdd: true };
    case "too_large":
      return { message: "That photo is too large. Try again with a smaller one.", retry: false };
    case "invalid_input":
      return { message: body.error ? `${body.error}.` : "That file can't be used as a receipt photo.", retry: false };
    case "not_pro":
      return { message: "Scanning receipts is part of Cooky Pro.", retry: false };
    case "quota_exhausted":
      return { message: `You've scanned the most receipts your plan allows for now${body.resetAt ? `; it resets ${new Date(body.resetAt).toLocaleString()}` : ""}.`, retry: false, manualAdd: true };
    case "ai_paused":
      return { message: "Receipt scanning is paused for today because the team's AI budget is used up. You can add groceries by hand.", retry: false, manualAdd: true };
    case "not_failed":
      return { message: "This receipt was already read. Reload to see it.", retry: false };
    case "not_implemented":
      return { message: "Adding to the fridge isn't switched on yet. Your receipt is saved; nothing in the fridge changed.", retry: false };
    case "already_confirmed":
      return { message: "These items were already added to your fridge.", retry: false };
    case "not_found":
      return { message: "That receipt no longer exists.", retry: false };
    default:
      if (status >= 500 || status === 0)
        return { message: "Cooky couldn't read the receipt this time. Nothing was added to your fridge.", retry: true, manualAdd: true };
      return { message: body.error ? `${body.error}.` : `Request failed (${status}).`, retry: false };
  }
}

export function formatQty(qty: number, unit: Unit): string {
  const n = Number.isInteger(qty) ? String(qty) : qty.toFixed(qty < 10 ? 2 : 1).replace(/\.?0+$/, "");
  return unit === "count" ? n : `${n} ${unit}`;
}

export const FLAG_TEXT: Record<NonNullable<ReceiptLine["flagReason"]>, string> = {
  unknown_ingredient: "Cooky doesn't know this item. Pick a category to add it.",
  low_confidence: "Hard to read. Check the name and amount.",
  unit_unconvertible: "Couldn't work out the amount. Enter it below.",
  implausible_quantity: "The amount looks wrong. Check it.",
  quantity_missing: "No amount printed. Enter how much you bought.",
};

/** The editable state of one food line on the review screen. */
export type EditLine = {
  lineId: string;
  include: boolean;
  ingredientId: string | null;
  name: string;
  category: Category | null;
  qty: string;
  unit: Unit | null;
  location: Location | null;
  expiresOn: string;
};

export function toEdit(l: ReceiptLine): EditLine {
  return {
    lineId: l.lineId,
    // Auto and generic lines are ticked; flagged lines wait for the user (the core tension, RCT4).
    include: l.decision === "auto" || l.decision === "generic",
    ingredientId: l.ingredientId,
    name: l.name,
    category: l.category,
    qty: l.qty === null ? "" : String(l.qty),
    unit: l.unit,
    location: l.location,
    expiresOn: l.expiresOn ?? "",
  };
}

/** What still stops a ticked line from being added, or null when it is ready. */
export function lineProblem(e: EditLine): string | null {
  if (!e.name.trim()) return "Enter a name";
  if (!e.ingredientId && !e.category) return "Pick a category";
  const qty = Number(e.qty);
  if (!e.qty.trim() || !Number.isFinite(qty) || qty <= 0) return "Enter an amount above zero";
  if (!e.unit) return "Pick a unit";
  if (!e.location) return "Pick where it goes";
  if (e.expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(e.expiresOn)) return "Use a full date";
  return null;
}

/** The confirm body: ticked, valid lines only. Lines not sent are not added. */
export function confirmBody(lines: EditLine[], idempotencyKey: string): ReceiptConfirm | { problems: Record<string, string> } {
  const ticked = lines.filter((l) => l.include);
  const problems = Object.fromEntries(ticked.flatMap((l) => {
    const p = lineProblem(l);
    return p ? [[l.lineId, p]] : [];
  }));
  if (Object.keys(problems).length) return { problems };
  return {
    lines: ticked.map((l) => ({
      lineId: l.lineId,
      include: true,
      ingredientId: l.ingredientId,
      name: l.name.trim(),
      category: l.category,
      qty: Number(l.qty),
      unit: l.unit as Unit,
      location: l.location as Location,
      expiresOn: l.expiresOn || null,
    })),
    idempotencyKey,
  };
}
