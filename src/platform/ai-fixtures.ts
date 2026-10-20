// What each AI unit returns in fake mode (AI_MODE=fake, or no ANTHROPIC_API_KEY). Fixtures go through
// the same schema, validation and repair path as real outputs, so a feature that works in fake mode
// is wired correctly. Owners: make your fixture realistic for your unit; it is also your demo fallback
// for UI work, never for the live demo.
import type { AiUnitName } from "@spec/contract";

type FakeInput = { system: string; text: string };

const firstMatch = (text: string, re: RegExp) => text.match(re)?.[0] ?? null;

export const aiFixtures: Record<AiUnitName, (input: FakeInput) => unknown> = {
  receipt_reader: () => ({
    isReceipt: true,
    store: "Trader Joe's",
    purchasedOn: null,
    lines: [
      { raw: "ORG BNLS CHKN BRST 1.32 LB", kind: "food", ingredientId: "ing_chicken_breast", category: "meat", name: "Chicken breast", qty: 1.32, unit: "lb", packageCount: 1, priceCents: 799, confidence: "high" },
      { raw: "BABY SPINACH 6 OZ", kind: "food", ingredientId: "ing_spinach", category: "produce", name: "Baby spinach", qty: 6, unit: "oz", packageCount: 1, priceCents: 229, confidence: "high" },
      { raw: "PITA CHIPS", kind: "food", ingredientId: null, category: "snacks", name: "Pita chips", qty: 1, unit: "ea", packageCount: 1, priceCents: 299, confidence: "high" },
      { raw: "TJ HRB BLND", kind: "food", ingredientId: null, category: null, name: "Herb blend?", qty: 1, unit: "ea", packageCount: 1, priceCents: 199, confidence: "low" },
      { raw: "BAG FEE", kind: "non_food", ingredientId: null, category: null, name: "Bag fee", qty: null, unit: null, packageCount: null, priceCents: 10, confidence: "high" },
    ],
  }),
  recipe_importer: () => ({
    isRecipe: true,
    title: "Garlic butter shrimp",
    baseServings: 2,
    minutes: 20,
    ingredients: [
      { ingredientId: "ing_garlic", name: "Garlic", qty: 3, unit: "count" },
      { ingredientId: null, name: "Shrimp", qty: 300, unit: "g" },
    ],
    steps: ["Melt the butter.", "Cook the garlic for one minute.", "Add the shrimp and cook until pink."],
  }),
  // Picks the first feasible set id that appears in the prompt, as a real choice must.
  planner: ({ text }) => {
    const setId = firstMatch(text, /set_[0-9a-z_]+/) ?? "set_none";
    const recipeIds = [...new Set(text.match(new RegExp(`${setId}:([^\\n]*)`))?.[1]?.match(/rcp_[0-9a-z_]+/g) ?? [])];
    return {
      setId,
      meals: recipeIds.map((recipeId) => ({ recipeId, reasons: ["Fits your budget and time (fake mode)."] })),
      usedPreferenceIds: [],
      usedFridgeItemIds: [],
      assumptions: ["Fake mode: no model was called."],
    };
  },
  // Cites the first chunk id in the prompt, so citation validation passes.
  cook_assistant: ({ text }) => {
    const chunk = firstMatch(text, /chk_[0-9a-z_]+/);
    return chunk
      ? { answer: "Follow the cited step (fake mode).", citations: [chunk], needsClarification: false, notCovered: false, safetyTopic: false }
      : { answer: "This recipe doesn't cover that.", citations: [], needsClarification: false, notCovered: true, safetyTopic: false };
  },
  preference_proposer: () => ({
    proposals: [{ kind: "soft", category: "texture", value: "prefers saucier dishes", reason: "You said the dish was a bit dry." }],
  }),
};
