import { describe, expect, it } from "vitest";
import {
  Chunk,
  CookAnswer,
  ErrorBody,
  FridgeView,
  PlanCreate,
  PlanDraft,
  ReceiptDraft,
  ReceiptExtraction,
  RecipeSummary,
} from "./contract";

const plan = {
  planId: "pln_01hzz",
  version: 1,
  status: "draft",
  servings: 2,
  budgetCents: 4000,
  meals: [
    {
      recipeId: "rcp_lemon_chicken",
      title: "Lemon chicken",
      reasons: ["Uses the chicken that expires Friday."],
      usesFridgeItemIds: ["itm_01abc"],
      usesPreferenceIds: [],
    },
  ],
  shopping: {
    items: [
      {
        ingredientId: "ing_chicken_breast",
        name: "Chicken breast",
        needQty: 700,
        unit: "g",
        haveQty: 200,
        buyQty: 500,
        packages: 2,
        packageSize: 400,
        packageCents: 500,
        costCents: 1000,
        leftoverQty: 300,
        forRecipeIds: ["rcp_lemon_chicken"],
      },
    ],
    totalCents: 1000,
    unpricedIngredientIds: [],
  },
  totalCents: 1000,
  priceAsOf: "2026-10-18",
  assumptions: ["Taxes are not included."],
};

describe("contract schemas", () => {
  it("accepts a valid plan draft", () => {
    expect(PlanDraft.safeParse(plan).success).toBe(true);
  });

  it("rejects a plan draft whose money is not integer cents", () => {
    const bad = { ...plan, totalCents: 10.5 };
    expect(PlanDraft.safeParse(bad).success).toBe(false);
  });

  it("allows an unknown price as null but not as a negative number", () => {
    const item = plan.shopping.items[0];
    const unknown = { ...plan, shopping: { ...plan.shopping, items: [{ ...item, costCents: null, packageCents: null }] } };
    const negative = { ...plan, shopping: { ...plan.shopping, items: [{ ...item, costCents: -1 }] } };
    expect(PlanDraft.safeParse(unknown).success).toBe(true);
    expect(PlanDraft.safeParse(negative).success).toBe(false);
  });

  it("rejects a plan request without an idempotency key", () => {
    expect(PlanCreate.safeParse({ servings: 2, budgetCents: 4000, maxMinutes: 30, meals: 3 }).success).toBe(false);
  });

  it("accepts a receipt draft with auto, generic, flagged and ignored lines", () => {
    const line = {
      lineId: "rln_1",
      raw: "ORG BNLS CHKN BRST 1.32 LB",
      kind: "food",
      ingredientId: "ing_chicken_breast",
      category: "meat",
      name: "Chicken breast",
      qty: 598.74,
      unit: "g",
      priceCents: 799,
      confidence: "high",
      decision: "auto",
      flagReason: null,
      location: "fridge",
      expiresOn: "2026-10-22",
    };
    const draft = {
      receiptId: "rct_1",
      status: "parsed",
      store: "Trader Joe's",
      purchasedOn: "2026-10-20",
      lines: [
        line,
        { ...line, lineId: "rln_2", raw: "PITA CHIPS", ingredientId: null, category: "snacks", name: "Pita chips", qty: 1, unit: "count", decision: "generic", location: "pantry" },
        { ...line, lineId: "rln_3", raw: "TJ HRB BLND", ingredientId: null, category: null, confidence: "low", decision: "flagged", flagReason: "low_confidence", location: null, expiresOn: null },
        { ...line, lineId: "rln_4", raw: "BAG FEE", kind: "non_food", ingredientId: null, category: null, decision: "ignored", qty: null, unit: null, location: null, expiresOn: null },
      ],
      planDiff: null,
    };
    expect(ReceiptDraft.safeParse(draft).success).toBe(true);
  });

  it("rejects a receipt line with a unit outside g, ml and count", () => {
    const result = ReceiptDraft.safeParse({
      receiptId: "rct_1",
      status: "parsed",
      store: null,
      purchasedOn: null,
      planDiff: null,
      lines: [
        {
          lineId: "rln_1", raw: "X", kind: "food", ingredientId: null, category: "other", name: "X", qty: 1, unit: "lb",
          priceCents: null, confidence: "high", decision: "generic", flagReason: null, location: "fridge", expiresOn: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fridge view with cook-now entries", () => {
    const view = {
      items: [
        {
          id: "itm_1", kind: "ingredient", ingredientId: "ing_spinach", recipeId: null, name: "Spinach", category: "produce",
          qty: 150, unit: "g", location: "fridge", addedOn: "2026-10-20", expiresOn: "2026-10-23", expirySource: "table",
          origin: "receipt", status: "active",
        },
      ],
      expiringSoon: ["itm_1"],
      cookNow: [{ recipeId: "rcp_frittata", title: "Spinach frittata", coverage: 0.8, usesExpiringItemIds: ["itm_1"], missingIngredientIds: [] }],
    };
    expect(FridgeView.safeParse(view).success).toBe(true);
  });

  it("accepts a cooking answer and an error body", () => {
    expect(
      CookAnswer.safeParse({
        answer: "Use a wide pan.",
        citations: [{ chunkId: "chk_stir_fry_s3", kind: "step", label: "Step 3" }],
        needsClarification: false,
        notCovered: false,
        safetyTopic: false,
        sessionId: "cks_1",
        run: { runId: "run_1", terminated: "done", latencyMs: 900, costUsd: 0.0004 },
      }).success,
    ).toBe(true);
    expect(ErrorBody.safeParse({ error: "Not implemented", status: 501, code: "not_implemented", requestId: "req_1" }).success).toBe(true);
  });

  it("keeps AI output schemas free of numeric bounds the model cannot enforce", () => {
    const out = ReceiptExtraction.safeParse({
      isReceipt: true,
      store: null,
      purchasedOn: null,
      lines: [{ raw: "MILK", kind: "food", ingredientId: null, category: "dairy", name: "Milk", qty: 1, unit: "gal", packageCount: 1, priceCents: 499, confidence: "medium" }],
    });
    expect(out.success).toBe(true);
  });
});

describe("journey-map fields (2026-10-21)", () => {
  const plan = { servings: 2, budgetCents: 4000, maxMinutes: 30, meals: 3, idempotencyKey: "key-12345678" };

  it("lets a plan request carry the recipes the user picked in the library", () => {
    const parsed = PlanCreate.safeParse({ ...plan, mustIncludeRecipeIds: ["rcp_spinach_frittata"] });
    expect(parsed.success && parsed.data.mustIncludeRecipeIds).toEqual(["rcp_spinach_frittata"]);
  });

  it("refuses more picked recipes than meals in the plan's upper limit", () => {
    const tooMany = ["rcp_a", "rcp_b", "rcp_c", "rcp_d", "rcp_e", "rcp_f"];
    expect(PlanCreate.safeParse({ ...plan, mustIncludeRecipeIds: tooMany }).success).toBe(false);
  });

  it("accepts a timed step and a prep tip as recipe chunks", () => {
    const base = { id: "chk_x_s2", recipeId: "rcp_x", label: "Step 2", text: "Sear the chicken." };
    expect(Chunk.safeParse({ ...base, kind: "step", stepNo: 2, timerSeconds: 480 }).success).toBe(true);
    expect(Chunk.safeParse({ ...base, id: "chk_x_t2", kind: "tip", stepNo: 2, label: "Tip", timerSeconds: null }).success).toBe(true);
    expect(Chunk.safeParse({ ...base, kind: "step", stepNo: 2, timerSeconds: 0 }).success).toBe(false);
  });

  it("gives recipe summaries an optional image", () => {
    const r = { id: "rcp_x", title: "X", minutes: 20, baseServings: 2, tags: [], equipment: [], custom: false };
    expect(RecipeSummary.safeParse({ ...r, imageUrl: null }).success).toBe(true);
    const withImage = RecipeSummary.safeParse({ ...r, imageUrl: "https://example.com/x.jpg" });
    expect(withImage.success && withImage.data.imageUrl).toBe("https://example.com/x.jpg");
    expect(RecipeSummary.safeParse({ ...r, imageUrl: "not a url" }).success).toBe(false);
  });
});
