// The Cooky contract: every request, response, record and AI output, as zod schemas.
// Pages, routes, modules and tests import from here. SPEC §8 is the prose index; this file wins.
// Changing a shape here changes it for every teammate: only the Platform owner edits it.
import { z } from "zod";
import targets from "./targets.json";

const L = targets.limits;

// ---------------------------------------------------------------- primitives

export const ID_PREFIXES = [
  "ing", "prd", "rcp", "chk", "itm", "evt", "pln", "plv", "rct", "rln",
  "cke", "cks", "prf", "prp", "alr", "ord", "run", "req",
] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** A prefixed id. Seeded ids are readable (`ing_chicken_breast`); generated ones are base32. */
export const id = (prefix: IdPrefix) => z.string().regex(new RegExp(`^${prefix}_[0-9a-z_]+$`), `expected a ${prefix}_ id`);

export const Cents = z.number().int().nonnegative();
export const NullableCents = Cents.nullable();
export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export const Qty = z.number().nonnegative();

export const Unit = z.enum(["g", "ml", "count"]);
export const Location = z.enum(["fridge", "freezer", "pantry"]);
export const Category = z.enum([
  "produce", "meat", "seafood", "dairy", "eggs", "bakery", "frozen",
  "pantry", "snacks", "beverages", "prepared", "other",
]);
export const LineKind = z.enum(["food", "non_food", "discount", "tax", "total", "other"]);
export const LineDecision = z.enum(["auto", "generic", "flagged", "ignored"]);
export const Confidence = z.enum(["high", "medium", "low"]);
export const FlagReason = z.enum([
  "unknown_ingredient", "low_confidence", "unit_unconvertible", "implausible_quantity", "quantity_missing",
]);
export const ItemKind = z.enum(["ingredient", "generic", "dish"]);
export const ItemStatus = z.enum(["active", "used", "tossed"]);
export const ExpirySource = z.enum(["table", "category", "user"]);
export const Origin = z.enum(["receipt", "manual", "cooked", "check"]);
export const PlanTier = z.enum(["free", "pro"]);
export const Terminated = z.enum(["done", "cap", "error"]);
export const PrefKind = z.enum(["hard", "soft"]);
export const PrefCategory = z.enum(["texture", "flavor", "effort", "cleanup", "ingredient", "cuisine"]);
export const AiUnitName = z.enum(["receipt_reader", "recipe_importer", "planner", "cook_assistant", "preference_proposer"]);

export type Unit = z.infer<typeof Unit>;
export type Location = z.infer<typeof Location>;
export type Category = z.infer<typeof Category>;
export type AiUnitName = z.infer<typeof AiUnitName>;

// ---------------------------------------------------------------- envelope

export const ErrorBody = z.object({
  error: z.string(),
  status: z.number().int(),
  code: z.string(),
  requestId: z.string(),
  resetAt: z.string().optional(),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

export const RunInfo = z.object({
  runId: z.string(),
  terminated: Terminated,
  latencyMs: z.number().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type RunInfo = z.infer<typeof RunInfo>;

export const RunStep = z.object({
  name: z.string(),
  ok: z.boolean(),
  ms: z.number().nonnegative(),
  error: z.string().optional(),
});
export const RunRecord = z.object({
  runId: z.string(),
  requestId: z.string(),
  unit: AiUnitName,
  model: z.string(),
  terminated: Terminated,
  wallMs: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  repairs: z.number().int().nonnegative(),
  steps: z.array(RunStep),
  error: z.string().optional(),
});
export type RunRecord = z.infer<typeof RunRecord>;

// ---------------------------------------------------------------- account

export const Profile = z.object({
  householdSize: z.number().int().min(L.servingsMin).max(L.servingsMax),
  budgetCentsDefault: Cents,
  maxMinutesDefault: z.number().int().positive(),
  equipment: z.array(z.string()),
  excludedIngredientIds: z.array(id("ing")),
  allergenTags: z.array(z.string()),
  stapleIngredientIds: z.array(id("ing")),
  timezone: z.string(),
  emailAlerts: z.boolean(),
});
export type Profile = z.infer<typeof Profile>;
export const ProfileInput = Profile;

export const QuotaUse = z.object({ used: z.number().int(), limit: z.number().int(), resetAt: z.string().nullable() });
export const Me = z.object({
  userId: z.string(),
  email: z.string(),
  plan: PlanTier,
  onboarded: z.boolean(),
  quotas: z.record(z.string(), QuotaUse),
});
export type Me = z.infer<typeof Me>;

export const Health = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  model: z.string(),
  aiMode: z.string(),
  db: z.string(),
  stripeMode: z.string(),
  storage: z.string(),
});
export type Health = z.infer<typeof Health>;

export const Entitlement = z.object({ plan: PlanTier, grantedAt: z.string().nullable() });
export type Entitlement = z.infer<typeof Entitlement>;
export const CheckoutResponse = z.object({ url: z.string().url() });

// ---------------------------------------------------------------- catalog and recipes

export const ShelfLifeDays = z.object({
  fridge: z.number().int().positive().optional(),
  freezer: z.number().int().positive().optional(),
  pantry: z.number().int().positive().optional(),
});

export const Ingredient = z.object({
  id: id("ing"),
  name: z.string(),
  aliases: z.array(z.string()),
  category: Category,
  baseUnit: Unit,
  allergenTags: z.array(z.string()),
  shelfLifeDays: ShelfLifeDays,
  shelfLifeSource: z.string(),
  custom: z.boolean(),
});
export type Ingredient = z.infer<typeof Ingredient>;

export const IngredientCreate = z.object({
  name: z.string().min(1),
  unit: Unit,
  category: Category,
  shelfLifeDays: ShelfLifeDays,
});

export const RecipeSummary = z.object({
  id: id("rcp"),
  title: z.string(),
  minutes: z.number().int().positive(),
  baseServings: z.number().int().positive(),
  tags: z.array(z.string()),
  equipment: z.array(z.string()),
  custom: z.boolean(),
  /** https image for library cards; null until Recipes & Cook adds photos */
  imageUrl: z.string().url().nullable(),
});
export type RecipeSummary = z.infer<typeof RecipeSummary>;

export const RecipeIngredient = z.object({
  ingredientId: id("ing"),
  name: z.string(),
  qty: Qty,
  unit: Unit,
  optional: z.boolean(),
  note: z.string().nullable(),
});

export const Chunk = z.object({
  id: id("chk"),
  recipeId: id("rcp"),
  /** step = an instruction; faq = a question and answer; tip = what to prep while a step runs */
  kind: z.enum(["step", "faq", "tip"]),
  stepNo: z.number().int().positive().nullable(),
  label: z.string(),
  text: z.string(),
  /** cook-mode timer for a step, in seconds; null when the step is not timed */
  timerSeconds: z.number().int().positive().nullable(),
});
export type Chunk = z.infer<typeof Chunk>;

export const Recipe = RecipeSummary.extend({
  ingredients: z.array(RecipeIngredient),
  steps: z.array(Chunk),
  faqs: z.array(Chunk),
  sourceUrl: z.string().nullable(),
  sourceLabel: z.string(),
});
export type Recipe = z.infer<typeof Recipe>;

export const RecipesQuery = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  cookableNow: z.enum(["true", "false"]).optional(),
});

export const RecipeDraftIngredient = z.object({
  ingredientId: id("ing").nullable(),
  name: z.string(),
  qty: Qty.nullable(),
  unit: Unit.nullable(),
  optional: z.boolean(),
  flagReason: FlagReason.nullable(),
});
export const RecipeDraft = z.object({
  title: z.string().min(1),
  baseServings: z.number().int().positive(),
  minutes: z.number().int().positive(),
  tags: z.array(z.string()),
  equipment: z.array(z.string()),
  ingredients: z.array(RecipeDraftIngredient),
  steps: z.array(z.string().min(1)),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  sourceUrl: z.string().nullable(),
  sourceLabel: z.string(),
});
export type RecipeDraft = z.infer<typeof RecipeDraft>;

export const ImportRequest = z.object({
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("url"), url: z.string().url() }),
    z.object({ kind: z.literal("text"), text: z.string().min(1).max(L.importTextMaxChars) }),
    z.object({ kind: z.literal("image"), uploadPath: z.string() }),
  ]),
});

// ---------------------------------------------------------------- planning

export const ShoppingItem = z.object({
  ingredientId: id("ing"),
  name: z.string(),
  needQty: Qty,
  unit: Unit,
  haveQty: Qty,
  buyQty: Qty,
  packages: z.number().int().nonnegative(),
  packageSize: Qty.nullable(),
  packageCents: NullableCents,
  costCents: NullableCents,
  leftoverQty: Qty,
  forRecipeIds: z.array(id("rcp")),
});
export type ShoppingItem = z.infer<typeof ShoppingItem>;

export const ShoppingList = z.object({
  items: z.array(ShoppingItem),
  totalCents: Cents,
  unpricedIngredientIds: z.array(id("ing")),
});
export type ShoppingList = z.infer<typeof ShoppingList>;

export const PlanMeal = z.object({
  recipeId: id("rcp"),
  title: z.string(),
  reasons: z.array(z.string()),
  usesFridgeItemIds: z.array(id("itm")),
  usesPreferenceIds: z.array(id("prf")),
});

export const PlanDraft = z.object({
  planId: id("pln"),
  version: z.number().int().positive(),
  status: z.enum(["draft", "saved"]),
  servings: z.number().int().min(L.servingsMin).max(L.servingsMax),
  budgetCents: Cents,
  meals: z.array(PlanMeal),
  shopping: ShoppingList,
  totalCents: Cents,
  priceAsOf: DateStr,
  assumptions: z.array(z.string()),
});
export type PlanDraft = z.infer<typeof PlanDraft>;
export const Plan = PlanDraft;
export type Plan = PlanDraft;

export const PlanSummary = z.object({
  planId: id("pln"),
  status: z.enum(["draft", "saved"]),
  version: z.number().int().positive(),
  createdAt: z.string(),
  mealTitles: z.array(z.string()),
  totalCents: Cents,
});

export const PlanCreate = z.object({
  servings: z.number().int().min(L.servingsMin).max(L.servingsMax),
  budgetCents: Cents,
  maxMinutes: z.number().int().positive(),
  meals: z.number().int().min(L.mealsPerPlanMin).max(L.mealsPerPlanMax),
  wishes: z.string().max(L.wishesMaxChars).optional(),
  mustUseItemIds: z.array(id("itm")).optional(),
  /** recipes the user picked in the library (step 3); the planner fills the remaining meals */
  mustIncludeRecipeIds: z.array(id("rcp")).max(L.mealsPerPlanMax).optional(),
  idempotencyKey: z.string().min(8),
});
export type PlanCreate = z.infer<typeof PlanCreate>;

export const PlanSwap = z.object({
  mealIndex: z.number().int().nonnegative(),
  reason: z.string().max(L.feedbackMaxChars).optional(),
  baseVersion: z.number().int().positive(),
});
export const PlanSave = z.object({ version: z.number().int().positive() });
export const ChecklistPatch = z.object({ ingredientId: id("ing"), checked: z.boolean() });
export const InfeasibleBody = ErrorBody.extend({
  cheapestFeasibleCents: NullableCents,
  relax: z.array(z.string()),
});

// ---------------------------------------------------------------- preferences

export const Preference = z.object({
  id: id("prf"),
  kind: PrefKind,
  category: PrefCategory,
  value: z.string(),
  scopeRecipeId: id("rcp").nullable(),
  confirmedAt: z.string(),
  active: z.boolean(),
});
export type Preference = z.infer<typeof Preference>;

export const PreferenceProposal = z.object({
  id: id("prp"),
  kind: PrefKind,
  category: PrefCategory,
  value: z.string(),
  reason: z.string(),
  scopeRecipeId: id("rcp").nullable(),
});
export type PreferenceProposal = z.infer<typeof PreferenceProposal>;

export const PreferenceCreate = z.union([
  z.object({ proposalId: id("prp"), scope: z.enum(["always", "once", "dismiss"]) }),
  z.object({ kind: PrefKind, category: PrefCategory, value: z.string().min(1) }),
]);
export const PreferencePatch = z.object({ value: z.string().min(1).optional(), active: z.boolean().optional() });

// ---------------------------------------------------------------- fridge

export const FridgeItem = z.object({
  id: id("itm"),
  kind: ItemKind,
  ingredientId: id("ing").nullable(),
  recipeId: id("rcp").nullable(),
  name: z.string(),
  category: Category.nullable(),
  qty: Qty,
  unit: Unit,
  location: Location,
  addedOn: DateStr,
  expiresOn: DateStr.nullable(),
  expirySource: ExpirySource,
  origin: Origin,
  status: ItemStatus,
});
export type FridgeItem = z.infer<typeof FridgeItem>;

export const CookNowEntry = z.object({
  recipeId: id("rcp"),
  title: z.string(),
  coverage: z.number().min(0).max(1),
  usesExpiringItemIds: z.array(id("itm")),
  missingIngredientIds: z.array(id("ing")),
});
export type CookNowEntry = z.infer<typeof CookNowEntry>;

export const FridgeView = z.object({
  items: z.array(FridgeItem),
  expiringSoon: z.array(id("itm")),
  cookNow: z.array(CookNowEntry),
});
export type FridgeView = z.infer<typeof FridgeView>;

/** A new fridge item created by a confirmed batch (receipt line, manual add, leftovers). */
export const NewFridgeItem = FridgeItem.omit({ id: true, addedOn: true, status: true });
export type NewFridgeItem = z.infer<typeof NewFridgeItem>;

/** One ledger event. `itemId: null` with `newItem` creates an item; otherwise `delta` changes one. */
export const BatchEvent = z.object({
  itemId: id("itm").nullable(),
  delta: z.number(),
  reason: z.enum(["purchase", "cook", "toss", "adjust", "move"]),
  newItem: NewFridgeItem.optional(),
});
export type BatchEvent = z.infer<typeof BatchEvent>;

export const FridgeItemCreate = z.object({
  ingredientId: id("ing").nullable(),
  name: z.string().min(1).optional(),
  category: Category.optional(),
  qty: z.number().positive(),
  unit: Unit,
  location: Location,
  expiresOn: DateStr.optional(),
  idempotencyKey: z.string().min(8),
});
export const FridgeItemPatch = z.object({
  qty: Qty.optional(),
  location: Location.optional(),
  expiresOn: DateStr.optional(),
  status: z.enum(["used", "tossed"]).optional(),
  /** The quantity the user saw; a different current quantity answers 409 stale_quantity (edit_fridge_item). */
  expectedQty: Qty.optional(),
  idempotencyKey: z.string().min(8),
});
export const FridgeCheck = z.object({
  updates: z.array(z.object({ itemId: id("itm"), action: z.enum(["keep", "used", "tossed"]), qty: Qty.optional() })),
  idempotencyKey: z.string().min(8),
});

// ---------------------------------------------------------------- receipts

export const ReceiptLine = z.object({
  lineId: id("rln"),
  raw: z.string(),
  kind: LineKind,
  ingredientId: id("ing").nullable(),
  category: Category.nullable(),
  name: z.string(),
  qty: Qty.nullable(),
  unit: Unit.nullable(),
  priceCents: NullableCents,
  confidence: Confidence,
  decision: LineDecision,
  flagReason: FlagReason.nullable(),
  location: Location.nullable(),
  expiresOn: DateStr.nullable(),
});
export type ReceiptLine = z.infer<typeof ReceiptLine>;

export const PlanDiff = z.object({
  missing: z.array(z.object({ ingredientId: id("ing"), forRecipeIds: z.array(id("rcp")) })),
  extra: z.array(id("ing")),
});

export const ReceiptDraft = z.object({
  receiptId: id("rct"),
  status: z.enum(["parsing", "parsed", "failed", "confirmed"]),
  store: z.string().nullable(),
  purchasedOn: DateStr.nullable(),
  lines: z.array(ReceiptLine),
  planDiff: PlanDiff.nullable(),
});
export type ReceiptDraft = z.infer<typeof ReceiptDraft>;

export const ReceiptConfirm = z.object({
  lines: z.array(
    z.object({
      lineId: id("rln"),
      include: z.boolean(),
      ingredientId: id("ing").nullable(),
      name: z.string(),
      category: Category.nullable(),
      qty: z.number().positive(),
      unit: Unit,
      location: Location,
      expiresOn: DateStr.nullable(),
    }),
  ),
  idempotencyKey: z.string().min(8),
});
export type ReceiptConfirm = z.infer<typeof ReceiptConfirm>;
export const ReceiptConfirmResponse = z.object({ addedItemIds: z.array(id("itm")), fridge: FridgeView });

// ---------------------------------------------------------------- cook

export const Deduction = z.object({
  itemId: id("itm"),
  ingredientId: id("ing"),
  qty: Qty,
  unit: Unit,
  shortBy: Qty.nullable(),
});
export type Deduction = z.infer<typeof Deduction>;

export const CookAsk = z.object({
  question: z.string().min(1).max(L.cookQuestionMaxChars),
  sessionId: id("cks").optional(),
});
export const Citation = z.object({ chunkId: id("chk"), kind: z.enum(["step", "faq", "tip"]), label: z.string() });
export const CookAnswer = z.object({
  answer: z.string(),
  citations: z.array(Citation),
  needsClarification: z.boolean(),
  notCovered: z.boolean(),
  safetyTopic: z.boolean(),
  sessionId: id("cks"),
  run: RunInfo,
});
export type CookAnswer = z.infer<typeof CookAnswer>;

export const CookDone = z.object({ servings: z.number().int().min(L.servingsMin).max(L.servingsMax), planId: id("pln").optional() });
export const CookDoneResponse = z.object({
  cookEventId: id("cke"),
  deductions: z.array(Deduction),
  /** Ingredients the recipe needs with no fridge item at all (a Deduction needs an item). */
  missing: z.array(z.object({ ingredientId: id("ing"), qty: Qty, unit: Unit })).optional(),
  leftovers: z.object({ servings: z.number().int().nonnegative(), expiresOn: DateStr }),
});
export const CookConfirm = z.object({
  deductions: z.array(z.object({ itemId: id("itm"), qty: Qty })),
  leftoverServings: z.number().int().nonnegative().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(L.feedbackMaxChars).optional(),
});
export const CookConfirmResponse = z.object({
  fridge: FridgeView,
  proposals: z.array(PreferenceProposal),
  run: RunInfo.nullable(),
});

// ---------------------------------------------------------------- alerts and stats (v2)

export const Alert = z.object({
  id: id("alr"),
  itemId: id("itm"),
  itemName: z.string(),
  expiresOn: DateStr,
  action: z.object({ recipeId: id("rcp").nullable(), recipeTitle: z.string().nullable(), freeze: z.boolean() }),
  dismissedAt: z.string().nullable(),
});
export const Stats = z.object({ tossedCents30d: Cents, tossedItems30d: z.number().int(), cookedMeals30d: z.number().int() });

// ---------------------------------------------------------------- AI outputs
// What each model call must return (SPEC §6.3). Kept free of regex and numeric bounds, which
// structured outputs cannot always enforce: code validates ids, ranges and units afterwards.

export const ReceiptExtraction = z.object({
  isReceipt: z.boolean(),
  store: z.string().nullable(),
  purchasedOn: z.string().nullable(),
  lines: z.array(
    z.object({
      raw: z.string(),
      kind: LineKind,
      ingredientId: z.string().nullable(),
      category: Category.nullable(),
      name: z.string(),
      qty: z.number().nullable(),
      unit: z.string().nullable(),
      packageCount: z.number().nullable(),
      priceCents: z.number().nullable(),
      confidence: Confidence,
    }),
  ),
});
export type ReceiptExtraction = z.infer<typeof ReceiptExtraction>;

export const RecipeExtraction = z.object({
  isRecipe: z.boolean(),
  title: z.string(),
  baseServings: z.number().nullable(),
  minutes: z.number().nullable(),
  ingredients: z.array(
    z.object({ ingredientId: z.string().nullable(), name: z.string(), qty: z.number().nullable(), unit: z.string().nullable() }),
  ),
  steps: z.array(z.string()),
});
export type RecipeExtraction = z.infer<typeof RecipeExtraction>;

export const PlannerChoice = z.object({
  setId: z.string(),
  meals: z.array(z.object({ recipeId: z.string(), reasons: z.array(z.string()) })),
  usedPreferenceIds: z.array(z.string()),
  usedFridgeItemIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});
export type PlannerChoice = z.infer<typeof PlannerChoice>;

export const CookAnswerOutput = z.object({
  answer: z.string(),
  citations: z.array(z.string()),
  needsClarification: z.boolean(),
  notCovered: z.boolean(),
  safetyTopic: z.boolean(),
});
export type CookAnswerOutput = z.infer<typeof CookAnswerOutput>;

export const PreferenceProposalsOutput = z.object({
  proposals: z.array(z.object({ kind: PrefKind, category: PrefCategory, value: z.string(), reason: z.string() })),
});
export type PreferenceProposalsOutput = z.infer<typeof PreferenceProposalsOutput>;
