import { describe, expect, it } from "vitest";
import { ReceiptLine, type ReceiptExtraction } from "@spec/contract";
import { classifyLine as rawClassify, defaultLocation, type LineCatalog } from "./lines";

type Extracted = ReceiptExtraction["lines"][number];

// Values copied from supabase/seed/*.csv so the tests read like real receipts.
const catalog: LineCatalog = {
  ingredients: new Map([
    ["ing_chicken_breast", { id: "ing_chicken_breast", name: "Chicken breast", category: "meat", baseUnit: "g", shelfLifeDays: { fridge: 2, freezer: 270 }, plausibleMaxQty: 3000 }],
    ["ing_egg", { id: "ing_egg", name: "Egg", category: "eggs", baseUnit: "count", shelfLifeDays: { fridge: 21 }, plausibleMaxQty: 36 }],
    ["ing_scallion", { id: "ing_scallion", name: "Scallion", category: "produce", baseUnit: "count", shelfLifeDays: { fridge: 7 }, plausibleMaxQty: 20 }],
    ["ing_rice", { id: "ing_rice", name: "Rice", category: "pantry", baseUnit: "g", shelfLifeDays: { pantry: 365 }, plausibleMaxQty: 5000 }],
    ["ing_frozen_peas", { id: "ing_frozen_peas", name: "Frozen peas", category: "frozen", baseUnit: "g", shelfLifeDays: { freezer: 240 }, plausibleMaxQty: 3000 }],
    ["ing_soy_sauce", { id: "ing_soy_sauce", name: "Soy sauce", category: "pantry", baseUnit: "ml", shelfLifeDays: { pantry: 365 }, plausibleMaxQty: 2000 }],
  ]),
  products: [
    { ingredientId: "ing_chicken_breast", packageSize: 600, unit: "g" },
    { ingredientId: "ing_scallion", packageSize: 6, unit: "count" },
    { ingredientId: "ing_rice", packageSize: 900, unit: "g" },
  ],
  categoryDefaults: new Map([
    ["snacks", { pantry: 60 }],
    ["bakery", { fridge: 7, freezer: 90, pantry: 4 }],
    ["dairy", { fridge: 7, freezer: 90 }],
    ["beverages", { fridge: 7, pantry: 180 }],
  ]),
};
const dates = { purchasedOn: "2026-10-20", today: "2026-10-21" };

/** Every case also proves the output fits the contract (and so the receipt_lines checks). */
function classifyLine(...args: Parameters<typeof rawClassify>) {
  const out = rawClassify(...args);
  const parsed = ReceiptLine.safeParse({ ...out, lineId: "rln_x" });
  expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
  return out;
}

function line(over: Partial<Extracted>): Extracted {
  return {
    raw: "RAW", kind: "food", ingredientId: null, category: null, name: "Item",
    qty: null, unit: null, packageCount: null, priceCents: null, confidence: "high",
    ...over,
  };
}

describe("classifyLine: auto-accept rule (RCT4)", () => {
  it("high confidence, valid id, unit converts, plausible qty → auto, converted to base unit", () => {
    const r = classifyLine(line({ raw: "BNLS CHKN BRST 1.32 LB", ingredientId: "ing_chicken_breast", category: "meat", qty: 1.32, unit: "lb", priceCents: 1054 }), catalog, dates);
    expect(r).toMatchObject({ decision: "auto", flagReason: null, ingredientId: "ing_chicken_breast", qty: 598.74, unit: "g", priceCents: 1054, category: "meat" });
  });

  it("medium or low confidence → flagged low_confidence, even with a valid id", () => {
    for (const confidence of ["medium", "low"] as const) {
      const r = classifyLine(line({ ingredientId: "ing_egg", qty: 12, unit: "ea", confidence }), catalog, dates);
      expect(r).toMatchObject({ decision: "flagged", flagReason: "low_confidence" });
    }
  });

  it("an id the catalog does not have (a model guess) → flagged unknown_ingredient, never generic", () => {
    const r = classifyLine(line({ ingredientId: "ing_dragonfruit", category: "produce", qty: 1, unit: "ea" }), catalog, dates);
    expect(r).toMatchObject({ decision: "flagged", flagReason: "unknown_ingredient", ingredientId: null });
  });

  it("a unit that does not convert, or converts to the wrong base unit → flagged unit_unconvertible", () => {
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 1, unit: "dozen-ish" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "unit_unconvertible" });
    // Eggs are counted; 2 lb of eggs cannot become a count in code.
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 2, unit: "lb" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "unit_unconvertible" });
  });

  it("over plausible_max_qty, or zero → flagged implausible_quantity", () => {
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 120, unit: "ea" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "implausible_quantity", qty: 120 });
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 0, unit: "ea" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "implausible_quantity" });
  });

  it("exactly at plausible_max_qty is still auto", () => {
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 36, unit: "ea" }), catalog, dates))
      .toMatchObject({ decision: "auto", qty: 36, unit: "count" });
  });

  it("non-food, discount, tax, total and other lines → ignored with no fridge fields", () => {
    for (const kind of ["non_food", "discount", "tax", "total", "other"] as const) {
      const r = classifyLine(line({ kind, raw: "TAX 0.83", priceCents: 83, ingredientId: "ing_egg", qty: 1, unit: "ea" }), catalog, dates);
      expect(r).toMatchObject({ decision: "ignored", flagReason: null, ingredientId: null, qty: null, unit: null, location: null, expiresOn: null, priceCents: 83 });
    }
  });
});

describe("classifyLine: values the contract and database reject", () => {
  it("a coupon's negative price is not a price: ignored, priceCents null", () => {
    expect(classifyLine(line({ kind: "discount", raw: "SC COUPON -1.00", priceCents: -100 }), catalog, dates))
      .toMatchObject({ decision: "ignored", priceCents: null });
  });

  it("a refund (negative quantity) → flagged implausible_quantity with no amount or price", () => {
    expect(classifyLine(line({ ingredientId: "ing_chicken_breast", qty: -1.32, unit: "lb", priceCents: -799 }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "implausible_quantity", qty: null, unit: null, priceCents: null });
    expect(classifyLine(line({ name: "Chips", category: "snacks", qty: -1, unit: "ea" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "implausible_quantity", qty: null, unit: null });
  });

  it("a fractional price read is unknown (null), never rounded or 0; the line is still auto", () => {
    expect(classifyLine(line({ ingredientId: "ing_chicken_breast", qty: 1, unit: "lb", priceCents: 799.5 }), catalog, dates))
      .toMatchObject({ decision: "auto", priceCents: null });
  });

  it("a package count that is not a positive whole number → flagged implausible_quantity", () => {
    for (const packageCount of [0, -2, 1.5]) {
      expect(classifyLine(line({ ingredientId: "ing_rice", qty: 16, unit: "oz", packageCount }), catalog, dates))
        .toMatchObject({ decision: "flagged", flagReason: "implausible_quantity", qty: null });
    }
  });
});

describe("classifyLine: units and quantities (RCT3)", () => {
  it("multiplies by package count before converting: 2 × 16 oz rice → 907.18 g", () => {
    expect(classifyLine(line({ ingredientId: "ing_rice", qty: 16, unit: "oz", packageCount: 2 }), catalog, dates))
      .toMatchObject({ decision: "auto", qty: 907.18, unit: "g" });
  });

  it("converts fl oz to ml", () => {
    expect(classifyLine(line({ ingredientId: "ing_soy_sauce", qty: 10, unit: "fl oz" }), catalog, dates))
      .toMatchObject({ decision: "auto", qty: 295.74, unit: "ml" });
  });

  it("bunch converts through the product's package size: 2 bunches of scallions → 12 count", () => {
    expect(classifyLine(line({ ingredientId: "ing_scallion", qty: 2, unit: "bunch" }), catalog, dates))
      .toMatchObject({ decision: "auto", qty: 12, unit: "count" });
  });

  it("bunch with no product for the ingredient → flagged unit_unconvertible", () => {
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 1, unit: "bunch" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "unit_unconvertible" });
  });

  it("no quantity printed → flagged quantity_missing (code never guesses an amount)", () => {
    expect(classifyLine(line({ ingredientId: "ing_chicken_breast", raw: "CHKN BRST 7.99", priceCents: 799 }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "quantity_missing", qty: null, unit: null });
  });
});

describe("classifyLine: location and expiry (RCT3)", () => {
  it("expiresOn = purchase date + shelf-life days for the default location", () => {
    expect(classifyLine(line({ ingredientId: "ing_chicken_breast", qty: 1, unit: "lb" }), catalog, dates))
      .toMatchObject({ location: "fridge", expiresOn: "2026-10-22" });
    expect(classifyLine(line({ ingredientId: "ing_rice", qty: 2, unit: "lb" }), catalog, dates))
      .toMatchObject({ location: "pantry", expiresOn: "2027-10-20" });
    expect(classifyLine(line({ ingredientId: "ing_frozen_peas", qty: 1, unit: "lb" }), catalog, dates))
      .toMatchObject({ location: "freezer", expiresOn: "2027-06-17" });
  });

  it("falls back to today when the purchase date is not legible", () => {
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 12, unit: "ea" }), catalog, { purchasedOn: null, today: "2026-10-21" }))
      .toMatchObject({ location: "fridge", expiresOn: "2026-11-11" });
  });

  it("flagged lines still carry a location and date so the review screen can prefill them", () => {
    expect(classifyLine(line({ ingredientId: "ing_egg", qty: 12, unit: "ea", confidence: "low" }), catalog, dates))
      .toMatchObject({ decision: "flagged", location: "fridge", expiresOn: "2026-11-10" });
  });
});

describe("classifyLine: generic items (RCT10)", () => {
  it("high-confidence food with no catalog match → generic, counted, category shelf life", () => {
    const r = classifyLine(line({ raw: "TORTILLA CHIPS", name: "Tortilla chips", category: "snacks", priceCents: 449 }), catalog, dates);
    expect(r).toMatchObject({ decision: "generic", flagReason: null, ingredientId: null, category: "snacks", name: "Tortilla chips", qty: 1, unit: "count", location: "pantry", expiresOn: "2026-12-19" });
  });

  it("generic count comes from the package count", () => {
    expect(classifyLine(line({ name: "Greek yogurt", category: "dairy", qty: 4, unit: "ea" }), catalog, dates))
      .toMatchObject({ decision: "generic", qty: 4, unit: "count", location: "fridge" });
  });

  it("a printed weight is kept as a weight for generic items", () => {
    expect(classifyLine(line({ name: "Sourdough", category: "bakery", qty: 1.5, unit: "lb" }), catalog, dates))
      .toMatchObject({ decision: "generic", qty: 680.39, unit: "g" });
  });

  it("generic with no category → flagged unknown_ingredient", () => {
    expect(classifyLine(line({ name: "Mystery item" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "unknown_ingredient" });
  });

  it("not-high confidence with no catalog match → flagged low_confidence", () => {
    expect(classifyLine(line({ name: "Chips", category: "snacks", confidence: "medium" }), catalog, dates))
      .toMatchObject({ decision: "flagged", flagReason: "low_confidence" });
  });
});

describe("defaultLocation", () => {
  it("prefers the fridge, uses the freezer for frozen food, the pantry for shelf-stable categories", () => {
    expect(defaultLocation("produce", { fridge: 5, freezer: 240 })).toBe("fridge");
    expect(defaultLocation("frozen", { freezer: 180 })).toBe("freezer");
    expect(defaultLocation("beverages", { fridge: 7, pantry: 180 })).toBe("pantry");
    expect(defaultLocation("produce", { pantry: 60 })).toBe("pantry");
    expect(defaultLocation("other", {})).toBeNull();
  });
});
