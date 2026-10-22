import { describe, expect, it } from "vitest";
import { ReceiptConfirm, type ReceiptLine } from "@spec/contract";
import { applyChange, confirmBody, receiptErrorMessage, toEdit, type ReviewShelf } from "./ui";

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

// Catalog values from supabase/seed: chicken g, fridge 2 / freezer 270; eggs count, fridge 21.
const shelf: ReviewShelf = {
  baseDate: "2026-10-20",
  ingredients: {
    ing_chicken_breast: { baseUnit: "g", shelfLifeDays: { fridge: 2, freezer: 270 } },
    ing_egg: { baseUnit: "count", shelfLifeDays: { fridge: 21 } },
  },
  categories: { snacks: { pantry: 60 }, bakery: { fridge: 7, freezer: 90, pantry: 4 } },
};
const chicken = line({ lineId: "rln_c", ingredientId: "ing_chicken_breast", category: "meat", name: "Chicken breast", qty: 598.74, unit: "g", expiresOn: "2026-10-22" });

describe("catalog lines keep the catalog unit", () => {
  it("a catalog line's unit is locked to its base unit, even when the draft had none", () => {
    const e = toEdit(line({ ingredientId: "ing_chicken_breast", unit: null, qty: null, decision: "flagged", flagReason: "unit_unconvertible" }), shelf);
    expect(e).toMatchObject({ unit: "g", unitLocked: true });
    expect(applyChange(e, { unit: "count" }, shelf).unit).toBe("g");
  });

  it("a line without a catalog id keeps a free unit", () => {
    const e = toEdit(line({ ingredientId: null, category: "snacks", unit: "count" }), shelf);
    expect(e.unitLocked).toBe(false);
    expect(applyChange(e, { unit: "g" }, shelf).unit).toBe("g");
  });
});

describe("the date follows the location until the user types one", () => {
  it("moving chicken to the freezer shows the freezer's typical date", () => {
    expect(applyChange(toEdit(chicken, shelf), { location: "freezer" }, shelf).expiresOn).toBe("2027-07-17");
  });

  it("a date the user typed stays put when the location changes", () => {
    const typed = applyChange(toEdit(chicken, shelf), { expiresOn: "2026-10-30" }, shelf);
    expect(applyChange(typed, { location: "freezer" }, shelf).expiresOn).toBe("2026-10-30");
  });

  it("a location with no typical shelf life clears the date rather than keeping a wrong one", () => {
    expect(applyChange(toEdit(chicken, shelf), { location: "pantry" }, shelf).expiresOn).toBe("");
  });

  it("an item not in the catalog follows its category: picking a category fills the date", () => {
    const herb = toEdit(line({ lineId: "rln_h", ingredientId: null, category: null, location: null, expiresOn: null, decision: "flagged" }), shelf);
    const withCat = applyChange(applyChange(herb, { location: "pantry" }, shelf), { category: "snacks" }, shelf);
    expect(withCat.expiresOn).toBe("2026-12-19");
  });
});

describe("the page shows the date confirm will store", () => {
  it("an untouched line starts at today's typical date, even if the catalog changed since the scan", () => {
    // Drafted when chicken kept 3 days in the fridge; the catalog now says 2.
    expect(toEdit({ ...chicken, expiresOn: "2026-10-23" }, shelf).expiresOn).toBe("2026-10-22");
  });

  it("without shelf data (or a location) the draft's date is kept", () => {
    expect(toEdit({ ...chicken, expiresOn: "2026-10-23" }).expiresOn).toBe("2026-10-23");
    expect(toEdit({ ...chicken, location: null, expiresOn: null }, shelf).expiresOn).toBe("");
  });
});
