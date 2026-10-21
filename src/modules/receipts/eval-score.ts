// Scoring for the receipts eval (SPEC §13, eval/README.md): compare the app's draft with a
// hand-written answer and measure the core tension, auto-accept precision against flag rate,
// plus food-line recall, time and cost. Pure code; the runner is eval-run.ts.
import { z } from "zod";
import { Category, LineKind, Unit, type ReceiptLine } from "@spec/contract";
import targets from "@spec/targets.json";

/** One case in eval/smoke/receipts/cases.json. Answers are written by hand, never from app output. */
export const ReceiptCase = z.object({
  image: z.string().min(1),
  notReceipt: z.boolean().default(false),
  lines: z.array(z.object({
    raw: z.string().min(1),
    kind: LineKind,
    ingredientId: z.string().nullable().default(null),
    /** For food with no catalog id: the category a generic item should get. */
    category: Category.nullable().default(null),
    /** In the base unit, as Cooky should store it (e.g. 1.32 lb → 598.74 g). */
    qty: z.number().nullable().default(null),
    unit: Unit.nullable().default(null),
  })),
});
export type ReceiptCase = z.infer<typeof ReceiptCase>;

export type Mistake = { raw: string; why: "ingredient" | "quantity" | "unit" | "category" | "not on the receipt" | "not food" };
export type CaseResult = {
  image: string;
  expectedFood: number;
  foundFood: number;
  accepted: number;
  acceptedCorrect: number;
  draftFood: number;
  flagged: number;
  notReceiptHandled: boolean | null;
  mistakes: Mistake[];
};

const words = (s: string) => new Set(s.toUpperCase().match(/[A-Z0-9]{2,}/g) ?? []);
/** Share of the expected line's words that the app's line contains. */
function overlap(expected: string, actual: string): number {
  const e = words(expected);
  if (e.size === 0) return 0;
  const a = words(actual);
  return [...e].filter((w) => a.has(w)).length / e.size;
}
const MATCH_AT = 0.6;

/** Expected line index → app line index, best word overlap first, each app line used once. */
export function matchLines(expected: ReceiptCase["lines"], actual: Pick<ReceiptLine, "raw">[]): Map<number, number> {
  const pairs = expected.flatMap((e, i) => actual.map((a, j) => ({ i, j, s: overlap(e.raw, a.raw) }))).filter((p) => p.s >= MATCH_AT);
  pairs.sort((x, y) => y.s - x.s || Math.abs(x.i - x.j) - Math.abs(y.i - y.j));
  const out = new Map<number, number>();
  const used = new Set<number>();
  for (const p of pairs) {
    if (out.has(p.i) || used.has(p.j)) continue;
    out.set(p.i, p.j);
    used.add(p.j);
  }
  return out;
}

/** Counts must be exact; weights and volumes within 2% or 1 g/ml (rounding of printed units). */
function sameQty(actual: number | null, expected: number | null, unit: string | null): boolean {
  if (actual === null || expected === null) return actual === expected;
  if (unit === "count") return actual === expected;
  return Math.abs(actual - expected) <= Math.max(1, 0.02 * expected);
}

export function scoreCase(c: ReceiptCase, draft: { isReceipt: boolean; lines: ReceiptLine[] }): CaseResult {
  const pairs = matchLines(c.lines, draft.lines);
  const byActual = new Map([...pairs].map(([i, j]) => [j, c.lines[i]]));
  const isFood = (l: ReceiptLine) => l.decision !== "ignored";
  const expectedFood = c.lines.filter((l) => l.kind === "food").length;
  const foundFood = c.lines.filter((l, i) => l.kind === "food" && pairs.has(i) && isFood(draft.lines[pairs.get(i)!])).length;

  const mistakes: Mistake[] = [];
  let accepted = 0;
  let acceptedCorrect = 0;
  draft.lines.forEach((l, j) => {
    if (l.decision !== "auto" && l.decision !== "generic") return;
    accepted++;
    const e = byActual.get(j);
    const why: Mistake["why"] | null =
      !e ? "not on the receipt"
      : e.kind !== "food" ? "not food"
      : l.decision === "generic" ? (e.ingredientId !== null || l.category !== e.category ? "category" : null)
      : l.ingredientId !== e.ingredientId ? "ingredient"
      : l.unit !== e.unit ? "unit"
      : !sameQty(l.qty, e.qty, e.unit) ? "quantity"
      : null;
    if (why) mistakes.push({ raw: l.raw, why });
    else acceptedCorrect++;
  });

  return {
    image: c.image,
    expectedFood,
    foundFood,
    accepted,
    acceptedCorrect,
    draftFood: draft.lines.filter(isFood).length,
    flagged: draft.lines.filter((l) => l.decision === "flagged").length,
    notReceiptHandled: c.notReceipt ? !draft.isReceipt : null,
    mistakes,
  };
}

export type RunStats = { ms: number; costUsd: number; ok: boolean };
export type Check = { key: string; target: number; value: number | null; pass: boolean };

function p95(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
}

/** Pools lines across receipts (the targets are about lines) and checks each declared target. */
export function aggregate(cases: { result: CaseResult; run: RunStats }[]) {
  const sum = (f: (r: CaseResult) => number) => cases.reduce((n, c) => n + f(c.result), 0);
  const accepted = sum((r) => r.accepted);
  const draftFood = sum((r) => r.draftFood);
  const expectedFood = sum((r) => r.expectedFood);
  const metrics = {
    precision: accepted ? sum((r) => r.acceptedCorrect) / accepted : null,
    flagRate: draftFood ? sum((r) => r.flagged) / draftFood : null,
    recall: expectedFood ? sum((r) => r.foundFood) / expectedFood : null,
    p95Ms: p95(cases.map((c) => c.run.ms)),
    costPerReceiptUsd: cases.length ? cases.reduce((n, c) => n + c.run.costUsd, 0) / cases.length : 0,
  };
  const t = targets.targets;
  const min = (key: string, target: number, value: number | null): Check => ({ key, target, value, pass: value !== null && value >= target });
  const max = (key: string, target: number, value: number | null): Check => ({ key, target, value, pass: value !== null && value <= target });
  const checks = [
    min("min_receipt_auto_accept_precision", t.min_receipt_auto_accept_precision, metrics.precision),
    max("max_receipt_flag_rate", t.max_receipt_flag_rate, metrics.flagRate),
    min("min_receipt_food_line_recall", t.min_receipt_food_line_recall, metrics.recall),
    max("max_receipt_parse_p95_ms", t.max_receipt_parse_p95_ms, metrics.p95Ms),
    max("max_cost_per_receipt_usd", t.max_cost_per_receipt_usd, metrics.costPerReceiptUsd),
  ];
  const notReceipts = cases.filter((c) => c.result.notReceiptHandled !== null);
  return { metrics, checks, notReceiptsHandled: `${notReceipts.filter((c) => c.result.notReceiptHandled).length}/${notReceipts.length}`, pass: checks.every((c) => c.pass) && notReceipts.every((c) => c.result.notReceiptHandled) };
}
