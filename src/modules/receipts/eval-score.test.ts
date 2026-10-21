import { describe, expect, it } from "vitest";
import type { ReceiptLine } from "@spec/contract";
import { ReceiptCase, aggregate, matchLines, scoreCase, type CaseResult } from "./eval-score";

let n = 0;
const got = (over: Partial<ReceiptLine>): ReceiptLine => ({
  lineId: `rln_${++n}`, raw: "RAW", kind: "food", ingredientId: null, category: null, name: "x", qty: null, unit: null,
  priceCents: null, confidence: "high", decision: "auto", flagReason: null, location: "fridge", expiresOn: null, ...over,
});
const want = (over: Partial<ReceiptCase["lines"][number]>): ReceiptCase["lines"][number] => ({
  raw: "RAW", kind: "food", ingredientId: null, category: null, qty: null, unit: null, ...over,
});
const chicken = want({ raw: "ORG BNLS CHKN BRST", ingredientId: "ing_chicken_breast", qty: 598.74, unit: "g" });
const spinach = want({ raw: "BABY SPINACH", ingredientId: "ing_spinach", qty: 170.1, unit: "g" });
const chips = want({ raw: "TORTILLA CHIPS", category: "snacks", qty: 1, unit: "count" });
const tax = want({ raw: "TAX", kind: "tax" });

describe("ReceiptCase", () => {
  it("accepts the README's case shape and a non-receipt case", () => {
    expect(ReceiptCase.parse({ image: "eval/smoke/receipts/r01.jpg", lines: [{ raw: "ORG BNLS CHKN BRST", kind: "food", ingredientId: "ing_chicken_breast", qty: 598.74, unit: "g" }] }).lines[0].category).toBeNull();
    expect(ReceiptCase.parse({ image: "eval/smoke/receipts/cat.jpg", notReceipt: true, lines: [] }).notReceipt).toBe(true);
  });
});

describe("matchLines", () => {
  it("pairs printed lines by their words, even when the app's raw text adds weight and price", () => {
    const pairs = matchLines([chicken, spinach], [got({ raw: "BABY SPINACH 6 OZ 2.29" }), got({ raw: "ORG BNLS CHKN BRST 1.32 LB 7.99" })]);
    expect(pairs.get(0)).toBe(1);
    expect(pairs.get(1)).toBe(0);
  });

  it("leaves a line unmatched when too few of its words appear", () => {
    expect(matchLines([chicken], [got({ raw: "CHKN NUGGETS" })]).size).toBe(0);
  });

  it("uses each app line at most once", () => {
    const pairs = matchLines([spinach, spinach], [got({ raw: "BABY SPINACH" })]);
    expect(pairs.size).toBe(1);
  });
});

describe("scoreCase", () => {
  it("counts a correct auto line, a correct generic line and an ignored tax line", () => {
    const r = scoreCase({ image: "x", notReceipt: false, lines: [chicken, chips, tax] }, {
      isReceipt: true,
      lines: [
        got({ raw: "ORG BNLS CHKN BRST 1.32 LB", ingredientId: "ing_chicken_breast", qty: 598.74, unit: "g", decision: "auto" }),
        got({ raw: "TORTILLA CHIPS", category: "snacks", qty: 1, unit: "count", decision: "generic" }),
        got({ raw: "TAX", kind: "tax", decision: "ignored" }),
      ],
    });
    expect(r).toMatchObject({ expectedFood: 2, foundFood: 2, accepted: 2, acceptedCorrect: 2, draftFood: 2, flagged: 0 });
  });

  it("an accepted line with the wrong ingredient, quantity, unit or category is wrong", () => {
    const r = scoreCase({ image: "x", notReceipt: false, lines: [chicken, spinach, chips] }, {
      isReceipt: true,
      lines: [
        got({ raw: "ORG BNLS CHKN BRST", ingredientId: "ing_chicken_breast", qty: 700, unit: "g" }),
        got({ raw: "BABY SPINACH", ingredientId: "ing_lemon", qty: 170.1, unit: "g" }),
        got({ raw: "TORTILLA CHIPS", category: "bakery", qty: 1, unit: "count", decision: "generic" }),
      ],
    });
    expect(r).toMatchObject({ accepted: 3, acceptedCorrect: 0 });
    expect(r.mistakes.map((m) => m.why)).toEqual(["quantity", "ingredient", "category"]);
  });

  it("quantities within 2% (or 1 g/ml) are correct; counts must be exact", () => {
    const close = scoreCase({ image: "x", notReceipt: false, lines: [chicken] }, { isReceipt: true, lines: [got({ raw: "ORG BNLS CHKN BRST", ingredientId: "ing_chicken_breast", qty: 600, unit: "g" })] });
    expect(close.acceptedCorrect).toBe(1);
    const eggs = want({ raw: "EGGS LARGE", ingredientId: "ing_egg", qty: 12, unit: "count" });
    const off = scoreCase({ image: "x", notReceipt: false, lines: [eggs] }, { isReceipt: true, lines: [got({ raw: "EGGS LARGE", ingredientId: "ing_egg", qty: 11.9, unit: "count" })] });
    expect(off.acceptedCorrect).toBe(0);
  });

  it("a flagged line is found but not accepted; a dropped line lowers recall; an invented accepted line is wrong", () => {
    const r = scoreCase({ image: "x", notReceipt: false, lines: [chicken, spinach] }, {
      isReceipt: true,
      lines: [
        got({ raw: "ORG BNLS CHKN BRST", ingredientId: "ing_chicken_breast", decision: "flagged", flagReason: "quantity_missing" }),
        got({ raw: "FREE PUPPY", ingredientId: "ing_egg", qty: 1, unit: "count", decision: "auto" }),
      ],
    });
    expect(r).toMatchObject({ expectedFood: 2, foundFood: 1, accepted: 1, acceptedCorrect: 0, draftFood: 2, flagged: 1 });
    expect(r.mistakes).toContainEqual(expect.objectContaining({ why: "not on the receipt" }));
  });

  it("a non-receipt case passes only when the app says it is not a receipt", () => {
    expect(scoreCase({ image: "x", notReceipt: true, lines: [] }, { isReceipt: false, lines: [] }).notReceiptHandled).toBe(true);
    expect(scoreCase({ image: "x", notReceipt: true, lines: [] }, { isReceipt: true, lines: [got({})] }).notReceiptHandled).toBe(false);
  });
});

describe("aggregate", () => {
  const base: CaseResult = { image: "x", expectedFood: 10, foundFood: 10, accepted: 8, acceptedCorrect: 8, draftFood: 10, flagged: 2, notReceiptHandled: null, mistakes: [] };
  const run = { ms: 1000, costUsd: 0.01, ok: true };

  it("pools lines across receipts and checks each target", () => {
    const a = aggregate([{ ...base, result: base, run }, { ...base, result: { ...base, acceptedCorrect: 7 }, run: { ...run, ms: 20000 } }].map(({ result, run }) => ({ result, run })));
    expect(a.metrics).toMatchObject({ precision: 15 / 16, flagRate: 4 / 20, recall: 1, p95Ms: 20000, costPerReceiptUsd: 0.01 });
    expect(a.checks.find((c) => c.key === "min_receipt_auto_accept_precision")).toMatchObject({ pass: false });
    expect(a.checks.find((c) => c.key === "max_receipt_flag_rate")).toMatchObject({ pass: true });
    expect(a.pass).toBe(false);
  });

  it("a failed run counts its receipt's food lines as not found", () => {
    const a = aggregate([{ result: base, run }, { result: { ...base, foundFood: 0, accepted: 0, acceptedCorrect: 0, draftFood: 0, flagged: 0 }, run: { ...run, ok: false } }]);
    expect(a.metrics.recall).toBe(0.5);
  });

  it("no accepted lines at all is not a pass for precision", () => {
    const a = aggregate([{ result: { ...base, accepted: 0, acceptedCorrect: 0, flagged: 10 }, run }]);
    expect(a.metrics.precision).toBeNull();
    expect(a.checks.find((c) => c.key === "min_receipt_auto_accept_precision")?.pass).toBe(false);
  });
});
