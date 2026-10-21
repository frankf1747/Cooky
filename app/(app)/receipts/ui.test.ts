import { describe, expect, it } from "vitest";
import { ReceiptConfirm, type ReceiptLine } from "@spec/contract";
import { confirmBody, receiptErrorMessage, toEdit } from "./ui";

const line = (over: Partial<ReceiptLine>): ReceiptLine => ({
  lineId: "rln_a", raw: "RAW", kind: "food", ingredientId: "ing_egg", category: "eggs", name: "Egg", qty: 12, unit: "count",
  priceCents: 399, confidence: "high", decision: "auto", flagReason: null, location: "fridge", expiresOn: "2026-11-10", ...over,
});

describe("toEdit", () => {
  it("ticks auto and generic lines, leaves flagged lines for the user", () => {
    expect(toEdit(line({ decision: "auto" })).include).toBe(true);
    expect(toEdit(line({ decision: "generic", ingredientId: null })).include).toBe(true);
    expect(toEdit(line({ decision: "flagged", flagReason: "low_confidence" })).include).toBe(false);
  });
});

describe("confirmBody", () => {
  it("sends ticked lines only, in the contract's shape", () => {
    const body = confirmBody([
      toEdit(line({ lineId: "rln_a" })),
      toEdit(line({ lineId: "rln_b", decision: "flagged", flagReason: "low_confidence" })),
    ], "key-12345678");
    expect(ReceiptConfirm.parse(body)).toEqual(body);
    expect("lines" in body && body.lines.map((l) => l.lineId)).toEqual(["rln_a"]);
  });

  it("an empty date is sent as null; a ticked flagged line the user fixed is sent", () => {
    const fixed = { ...toEdit(line({ lineId: "rln_b", decision: "flagged", flagReason: "quantity_missing", qty: null, expiresOn: null })), include: true, qty: "600", unit: "g" as const };
    const body = confirmBody([fixed], "key-12345678");
    expect(body).toMatchObject({ lines: [{ lineId: "rln_b", qty: 600, unit: "g", expiresOn: null }] });
  });

  it("returns the problem for each ticked line that is not ready, and no body", () => {
    const noQty = { ...toEdit(line({ lineId: "rln_q", qty: null })), include: true };
    const noCat = { ...toEdit(line({ lineId: "rln_c", ingredientId: null, category: null })), include: true };
    const unticked = toEdit(line({ lineId: "rln_u", decision: "flagged", qty: null }));
    expect(confirmBody([noQty, noCat, unticked], "key-12345678")).toEqual({
      problems: { rln_q: "Enter an amount above zero", rln_c: "Pick a category" },
    });
  });
});

describe("receiptErrorMessage (RCT7)", () => {
  it("a non-receipt offers manual add, not retry", () => {
    expect(receiptErrorMessage(422, { code: "not_a_receipt" })).toMatchObject({ retry: false, manualAdd: true });
  });
  it("a model failure (502) offers retry and manual add", () => {
    expect(receiptErrorMessage(502, { code: "model_error" })).toMatchObject({ retry: true, manualAdd: true });
  });
  it("a network failure (status 0) offers retry", () => {
    expect(receiptErrorMessage(0, {})).toMatchObject({ retry: true });
  });
});
