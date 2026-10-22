// Plan & Shop eval runners (eval/README.md, SPEC §13): `npm run eval -- calc` and `npm run eval -- plans`.
// Both run the real planning code against the seed catalog read straight from supabase/seed/*.csv,
// so they need no database.
//  - calc: buildShoppingList must match hand-computed answers exactly (min_shopping_calc_exact_rate).
//  - plans: feasible sets + the planner (fake mode by default; live when ANTHROPIC_API_KEY is set,
//    which spends the team budget), then an independent check of every plan against the case's
//    hard constraints (min_plan_constraint_pass_rate, min_plan_success_rate, min_infeasible_honesty_rate).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { PrefCategory, PrefKind, Unit } from "@spec/contract";
import targets from "@spec/targets.json";
import { __setAiDeps } from "@/platform/ai";
import { ApiError } from "@/platform/errors";
import { parseCsv } from "../../../scripts/csv";
import type { PlanningData } from "./data";
import { findFeasibleSets, type CatalogIngredient, type PlanningRecipe } from "./feasible";
import { buildShoppingList, type ProductInput } from "./shopping";

const SEED = "supabase/seed";
const list = (s: string) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);

export type Catalog = { recipes: PlanningRecipe[]; ingredients: CatalogIngredient[]; products: ProductInput[]; priceAsOf: string | null };

/** The seed catalog, in the shapes the planning code takes. */
export function seedCatalog(read = (f: string) => readFileSync(`${SEED}/${f}`, "utf8")): Catalog {
  const ri = parseCsv(read("recipe_ingredients.csv"));
  const products = parseCsv(read("products.csv"));
  return {
    recipes: parseCsv(read("recipes.csv")).map((r) => ({
      id: r.id,
      title: r.title,
      baseServings: Number(r.base_servings),
      minutes: Number(r.minutes),
      equipment: list(r.equipment),
      ingredients: ri.filter((x) => x.recipe_id === r.id).map((x) => ({
        ingredientId: x.ingredient_id, qty: Number(x.qty), unit: x.unit as Unit, optional: x.optional === "true",
      })),
    })),
    ingredients: parseCsv(read("ingredients.csv")).map((i) => ({ id: i.id, name: i.name, allergenTags: list(i.allergen_tags) })),
    products: products.map((p) => ({ id: p.id, ingredientId: p.ingredient_id, packageSize: Number(p.package_size), unit: p.unit as Unit, priceCents: Number(p.price_cents) })),
    priceAsOf: products.map((p) => p.price_date).sort().at(-1) ?? null,
  };
}

function writeRun(set: string, result: unknown): string {
  if (!existsSync("eval/runs")) mkdirSync("eval/runs", { recursive: true });
  const out = `eval/runs/${set}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(out, JSON.stringify(result, null, 2));
  return out;
}
const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);

// ---------------------------------------------------------------- calc

const Stock = z.object({ ingredientId: z.string(), qty: z.number(), unit: Unit });
export const CalcCase = z.object({
  id: z.string(),
  note: z.string().optional(),
  recipes: z.array(z.string()).min(1),
  servings: z.number().int().positive(),
  fridge: z.array(Stock).default([]),
  staples: z.array(z.string()).default([]),
  expect: z.object({
    items: z.array(z.object({
      ingredientId: z.string(),
      packages: z.number().int(),
      costCents: z.number().int().nullable(),
      leftoverQty: z.number(),
    })),
    totalCents: z.number().int(),
  }),
});
type CalcCase = z.infer<typeof CalcCase>;

/** Exact comparison: every expected line, no extra lines, and the total. */
export function scoreCalc(cases: CalcCase[], catalog: Catalog) {
  const rows = cases.map((c) => {
    const missing = c.recipes.filter((id) => !catalog.recipes.some((r) => r.id === id));
    if (missing.length) return { id: c.id, pass: false, diffs: [`unknown recipe ids: ${missing.join(", ")}`] };
    const got = buildShoppingList({
      servings: c.servings,
      recipes: catalog.recipes.filter((r) => c.recipes.includes(r.id)),
      ingredients: catalog.ingredients,
      products: catalog.products,
      fridge: c.fridge,
      stapleIngredientIds: c.staples,
    });
    const diffs: string[] = [];
    for (const e of c.expect.items) {
      const g = got.items.find((i) => i.ingredientId === e.ingredientId);
      if (!g) { diffs.push(`${e.ingredientId}: expected on the list, missing`); continue; }
      for (const k of ["packages", "costCents", "leftoverQty"] as const) {
        if (g[k] !== e[k]) diffs.push(`${e.ingredientId}.${k}: expected ${e[k]}, got ${g[k]}`);
      }
    }
    for (const g of got.items) if (!c.expect.items.some((e) => e.ingredientId === g.ingredientId)) diffs.push(`${g.ingredientId}: on the list but not expected`);
    if (got.totalCents !== c.expect.totalCents) diffs.push(`totalCents: expected ${c.expect.totalCents}, got ${got.totalCents}`);
    return { id: c.id, pass: diffs.length === 0, diffs };
  });
  return { rows, exactRate: rows.length ? rows.filter((r) => r.pass).length / rows.length : null };
}

export async function runCalcEval(casesPath = "eval/smoke/calc/cases.json"): Promise<number> {
  const cases = z.array(CalcCase).parse(JSON.parse(readFileSync(casesPath, "utf8")));
  if (!cases.length) {
    console.log(`eval calc: ${casesPath} has no cases yet (format: eval/README.md).`);
    return 1;
  }
  if (cases.length < targets.workload.smokeSets.calc)
    console.log(`eval calc: ${cases.length} cases; the smoke set calls for ${targets.workload.smokeSets.calc}.`);
  const result = scoreCalc(cases, seedCatalog());
  for (const r of result.rows) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id}${r.diffs.length ? `\n  - ${r.diffs.join("\n  - ")}` : ""}`);
  const target = targets.targets.min_shopping_calc_exact_rate;
  console.log(`eval calc: exact ${pct(result.exactRate)} (target ${pct(target)})`);
  console.log(`eval calc: results in ${writeRun("calc", { set: "calc", ...result })}`);
  return result.exactRate !== null && result.exactRate >= target ? 0 : 2;
}

// ---------------------------------------------------------------- plans

export const PlansCase = z.object({
  id: z.string(),
  note: z.string().optional(),
  input: z.object({
    servings: z.number().int(),
    budgetCents: z.number().int(),
    maxMinutes: z.number().int(),
    meals: z.number().int(),
    wishes: z.string().optional(),
    mustUseItemIds: z.array(z.string()).optional(),
    mustIncludeRecipeIds: z.array(z.string()).optional(),
  }),
  fridge: z.array(z.object({ id: z.string(), ingredientId: z.string(), qty: z.number(), unit: Unit, expiresOn: z.string().nullable().default(null) })).default([]),
  preferences: z.array(z.object({ id: z.string(), kind: PrefKind, category: PrefCategory, value: z.string(), scopeRecipeId: z.string().nullable().default(null) })).default([]),
  profile: z.object({
    excludedIngredientIds: z.array(z.string()).default([]),
    allergenTags: z.array(z.string()).default([]),
    stapleIngredientIds: z.array(z.string()).default([]),
  }).default({ excludedIngredientIds: [], allergenTags: [], stapleIngredientIds: [] }),
  /** No meal may use these in a required ingredient (exclusions, hard preferences). */
  forbiddenIngredientIds: z.array(z.string()).default([]),
  /** Every meal must avoid ingredients with these allergen tags, optional ones included. */
  forbiddenAllergens: z.array(z.string()).default([]),
  /** Recipes that must be in the plan (picks). */
  expectRecipeIds: z.array(z.string()).default([]),
  /** At least one meal must use each of these (must-use fridge items). */
  expectUsesIngredientIds: z.array(z.string()).default([]),
  expectInfeasible: z.boolean(),
});
type PlansCase = z.infer<typeof PlansCase>;

type PlanOutcome = { kind: "plan"; recipeIds: string[]; totalCents: number } | { kind: "infeasible"; relax: string[] } | { kind: "error"; message: string };

/** Hard-constraint check of one returned plan, independent of the code that built it (G8). */
export function violations(c: PlansCase, plan: { recipeIds: string[]; totalCents: number }, catalog: Catalog): string[] {
  const v: string[] = [];
  const recipes = plan.recipeIds.map((id) => catalog.recipes.find((r) => r.id === id));
  plan.recipeIds.forEach((id, i) => { if (!recipes[i]) v.push(`unknown recipe ${id}`); });
  if (new Set(plan.recipeIds).size !== plan.recipeIds.length) v.push("a recipe appears twice");
  if (plan.recipeIds.length !== c.input.meals) v.push(`${plan.recipeIds.length} meals for ${c.input.meals} asked`);
  if (plan.totalCents > c.input.budgetCents) v.push(`total ${plan.totalCents} over budget ${c.input.budgetCents}`);
  const tags = new Map(catalog.ingredients.map((i) => [i.id, i.allergenTags]));
  for (const r of recipes) {
    if (!r) continue;
    if (r.minutes > c.input.maxMinutes) v.push(`${r.id} takes ${r.minutes} min (max ${c.input.maxMinutes})`);
    for (const i of r.ingredients) {
      if (!i.optional && c.forbiddenIngredientIds.includes(i.ingredientId)) v.push(`${r.id} uses forbidden ${i.ingredientId}`);
      const hit = (tags.get(i.ingredientId) ?? []).filter((t) => c.forbiddenAllergens.includes(t));
      if (hit.length) v.push(`${r.id} has allergen ${hit.join(",")} (${i.ingredientId})`);
    }
  }
  for (const id of c.expectRecipeIds) if (!plan.recipeIds.includes(id)) v.push(`picked ${id} is missing`);
  for (const ing of c.expectUsesIngredientIds) {
    if (!recipes.some((r) => r?.ingredients.some((i) => !i.optional && i.ingredientId === ing))) v.push(`no meal uses must-use ${ing}`);
  }
  return v;
}

export function scorePlans(cases: PlansCase[], outcomes: PlanOutcome[], catalog: Catalog) {
  const rows = cases.map((c, i) => {
    const o = outcomes[i];
    const v = o.kind === "plan" ? violations(c, o, catalog) : [];
    const pass = c.expectInfeasible ? o.kind === "infeasible" : o.kind === "plan" && v.length === 0;
    return { id: c.id, expectInfeasible: c.expectInfeasible, outcome: o, violations: v, pass };
  });
  const shown = rows.filter((r) => r.outcome.kind === "plan");
  const feasible = rows.filter((r) => !r.expectInfeasible);
  const infeasible = rows.filter((r) => r.expectInfeasible);
  return {
    rows,
    constraintPassRate: shown.length ? shown.filter((r) => r.violations.length === 0).length / shown.length : null,
    successRate: feasible.length ? feasible.filter((r) => r.outcome.kind === "plan" && r.violations.length === 0).length / feasible.length : null,
    infeasibleHonestyRate: infeasible.length ? infeasible.filter((r) => r.outcome.kind === "infeasible").length / infeasible.length : null,
  };
}

/** One case through the same steps as createPlan: feasible sets, then the planner via runAi. */
async function planCase(c: PlansCase, catalog: Catalog, n: number): Promise<PlanOutcome> {
  const { choosePlan } = await import("./index");
  const hard = c.preferences.filter((p) => p.kind === "hard").map(({ id, category, value, scopeRecipeId }) => ({ id, category, value, scopeRecipeId }));
  const soft = c.preferences.filter((p) => p.kind === "soft").map(({ id, category, value, scopeRecipeId }) => ({ id, category, value, scopeRecipeId }));
  const data: PlanningData = {
    ...catalog,
    fridge: c.fridge,
    profile: { ...c.profile, equipment: [] },
    hardPreferences: hard,
    softPreferences: soft,
    oneTimeNotes: [],
    timezone: "America/Los_Angeles",
  };
  const picks = c.input.mustIncludeRecipeIds ?? [];
  const result = findFeasibleSets({ ...data, ...c.input, mustUseItemIds: c.input.mustUseItemIds ?? [], mustIncludeRecipeIds: picks });
  if (!result.ok) return { kind: "infeasible", relax: result.relax };
  try {
    const { draft } = await choosePlan("eval-user", `eval_${c.id}_${n}`, data, c.input, result.sets, result.droppedPicks, picks);
    return { kind: "plan", recipeIds: draft.meals.map((m) => m.recipeId), totalCents: draft.totalCents };
  } catch (err) {
    return { kind: "error", message: err instanceof ApiError ? `${err.status} ${err.code}: ${err.message}` : String(err) };
  }
}

export async function runPlansEval(casesPath = "eval/smoke/plans/cases.json"): Promise<number> {
  const cases = z.array(PlansCase).parse(JSON.parse(readFileSync(casesPath, "utf8")));
  if (!cases.length) {
    console.log(`eval plans: ${casesPath} has no cases yet (format: eval/README.md).`);
    return 1;
  }
  const { plans: wanted, plansInfeasible } = targets.workload.smokeSets;
  const infeasibleCount = cases.filter((c) => c.expectInfeasible).length;
  if (cases.length - infeasibleCount < wanted || infeasibleCount < plansInfeasible)
    console.log(`eval plans: ${cases.length - infeasibleCount} feasible and ${infeasibleCount} infeasible cases; the smoke set calls for ${wanted} and ${plansInfeasible}.`);

  // No database here: runs are not recorded, there is no per-user quota, and the spend check is
  // skipped. The model mode comes from config (fake unless ANTHROPIC_API_KEY is set).
  const live = Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AI_MODE !== "fake";
  __setAiDeps({ recordRun: async () => {}, spentTodayUsd: async () => 0, consumeQuota: async () => ({ release: async () => {} }) });
  console.log(`eval plans: planner in ${live ? "LIVE mode (uses the team AI budget)" : "fake mode"}`);

  const catalog = seedCatalog();
  const outcomes: PlanOutcome[] = [];
  for (const [n, c] of cases.entries()) outcomes.push(await planCase(c, catalog, n));
  const result = scorePlans(cases, outcomes, catalog);
  for (const r of result.rows) {
    const what = r.outcome.kind === "plan" ? `plan ${r.outcome.recipeIds.join(" + ")} ${r.outcome.totalCents}¢`
      : r.outcome.kind === "infeasible" ? `infeasible (relax: ${r.outcome.relax.join(", ")})` : `error ${r.outcome.message}`;
    console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id} expected ${r.expectInfeasible ? "infeasible" : "a valid plan"}; got ${what}${r.violations.length ? `\n  - ${r.violations.join("\n  - ")}` : ""}`);
  }
  const t = targets.targets;
  console.log(`eval plans: constraint pass ${pct(result.constraintPassRate)} (target ${pct(t.min_plan_constraint_pass_rate)})`);
  console.log(`eval plans: success ${pct(result.successRate)} (target ${pct(t.min_plan_success_rate)})`);
  console.log(`eval plans: infeasible honesty ${pct(result.infeasibleHonestyRate)} (target ${pct(t.min_infeasible_honesty_rate)})`);
  console.log(`eval plans: results in ${writeRun("plans", { set: "plans", mode: live ? "live" : "fake", ...result })}`);
  const met = (x: number | null, min: number) => x === null || x >= min;
  return met(result.constraintPassRate, t.min_plan_constraint_pass_rate) && met(result.successRate, t.min_plan_success_rate) &&
    met(result.infeasibleHonestyRate, t.min_infeasible_honesty_rate) ? 0 : 2;
}
