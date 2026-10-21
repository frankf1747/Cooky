import { describe, expect, it } from "vitest";
import { PlanDiff, type ReceiptLine, type ShoppingList } from "@spec/contract";
import { planDiff } from "./plan-diff";

const item = (ingredientId: string, buyQty: number, forRecipeIds: string[]): ShoppingList["items"][number] => ({
  ingredientId, name: ingredientId, needQty: buyQty, unit: "g", haveQty: 0, buyQty, packages: buyQty > 0 ? 1 : 0,
  packageSize: 100, packageCents: 100, costCents: buyQty > 0 ? 100 : 0, leftoverQty: 0, forRecipeIds,
});
const shopping = (items: ShoppingList["items"]): ShoppingList => ({ items, totalCents: 0, unpricedIngredientIds: [] });

let n = 0;
const line = (over: Partial<ReceiptLine>): ReceiptLine => ({
  lineId: `rln_${++n}`, raw: "RAW", kind: "food", ingredientId: null, category: "produce", name: "x", qty: 1, unit: "count",
  priceCents: null, confidence: "high", decision: "auto", flagReason: null, location: "fridge", expiresOn: null, ...over,
});

describe("planDiff (RCT5)", () => {
  it("planned to buy but not on the receipt → missing, with the recipes that need it", () => {
    const d = planDiff(
      [line({ ingredientId: "ing_chicken_breast" })],
      shopping([item("ing_chicken_breast", 600, ["rcp_a"]), item("ing_garlic", 3, ["rcp_a", "rcp_b"])]),
    );
    expect(PlanDiff.parse(d)).toEqual(d);
    expect(d.missing).toEqual([{ ingredientId: "ing_garlic", forRecipeIds: ["rcp_a", "rcp_b"] }]);
    expect(d.extra).toEqual([]);
  });

  it("bought catalog items the plan does not use → extra, once each, in receipt order", () => {
    const d = planDiff(
      [line({ ingredientId: "ing_rice" }), line({ ingredientId: "ing_chicken_breast" }), line({ ingredientId: "ing_rice" }), line({ ingredientId: "ing_egg" })],
      shopping([item("ing_chicken_breast", 600, ["rcp_a"])]),
    );
    expect(d.extra).toEqual(["ing_rice", "ing_egg"]);
  });

  it("a plan item the fridge already covers (buy 0) is never missing, and buying it is not extra", () => {
    const d = planDiff([line({ ingredientId: "ing_egg" })], shopping([item("ing_egg", 0, ["rcp_a"]), item("ing_salt", 0, ["rcp_a"])]));
    expect(d).toEqual({ missing: [], extra: [] });
  });

  it("flagged lines with a catalog match count as bought; generic and ignored lines never count", () => {
    const d = planDiff(
      [
        line({ ingredientId: "ing_garlic", decision: "flagged", flagReason: "low_confidence" }),
        line({ ingredientId: null, decision: "generic", name: "Chips", category: "snacks" }),
        line({ ingredientId: "ing_onion", kind: "non_food", decision: "ignored" }),
      ],
      shopping([item("ing_garlic", 3, ["rcp_a"]), item("ing_onion", 1, ["rcp_b"])]),
    );
    expect(d).toEqual({ missing: [{ ingredientId: "ing_onion", forRecipeIds: ["rcp_b"] }], extra: [] });
  });

  it("an empty receipt against a plan → everything to buy is missing", () => {
    expect(planDiff([], shopping([item("ing_a", 1, ["rcp_a"]), item("ing_b", 0, ["rcp_a"])])).missing.map((m) => m.ingredientId)).toEqual(["ing_a"]);
  });
});
