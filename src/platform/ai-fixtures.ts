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
  // Answers the person's words: the title comes from them, and catalog items they name become
  // ingredients in the catalog's unit (garlic and olive oil when they name none). One ingredient
  // outside the catalog keeps the "fix this row" path exercised in the UI.
  recipe_importer: ({ system, text }) => {
    const asked = (text.match(/<user_text>[^\n]*\n([\s\S]*?)\n<\/user_text>/)?.[1] ?? text).trim();
    const catalog = [...system.matchAll(/^(ing_[0-9a-z_]+) \| ([^|]+) \| ([^|\n]*) \| (g|ml|count)$/gm)].map((m) => ({ id: m[1], name: m[2].trim(), words: `${m[2]} ${m[3]}`, unit: m[4] }));
    const said = (w: string) => w.length >= 3 && new RegExp(`\\b${w}\\b`).test(asked.toLowerCase());
    const named = catalog.filter((c) => c.words.toLowerCase().split(/[^a-z]+/).some(said)).slice(0, 5);
    const picked = named.length ? named : catalog.filter((c) => c.id === "ing_garlic" || c.id === "ing_olive_oil");
    const amount = (unit: string) => (unit === "count" ? 2 : unit === "ml" ? 15 : 150);
    const title = asked.replace(/^(i (want|feel like|fancy)|something|some|a|an)\s+/i, "").slice(0, 60) || "Bao's weeknight dinner";
    return {
      isRecipe: asked.length > 0,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      baseServings: 2,
      minutes: 25,
      ingredients: [
        ...picked.map((c) => ({ ingredientId: c.id, name: c.name, qty: amount(c.unit), unit: c.unit })),
        { ingredientId: null, name: "Fresh herbs", qty: 10, unit: "g" },
      ],
      steps: ["Get everything ready and heat a pan over medium heat.", "Cook the main ingredients until golden, about 8 minutes.", "Add the rest and cook until hot through.", "Taste, season and serve. (fake mode)"],
    };
  },
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
