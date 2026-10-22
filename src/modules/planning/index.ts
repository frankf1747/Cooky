// Owner: Plan & Shop. Feasible sets, shopping math, the planner, saved plans (SPEC §5.3).
// Shopping math lives in shopping.ts (create it) and is pure code: the model never does arithmetic.
import type { z } from "zod";
import type { ChecklistPatch, PlanCreate, PlanDraft, PlanSave, PlanSummary, PlanSwap, PreferenceProposal, RunInfo, ShoppingList } from "@spec/contract";
import { PlannerChoice } from "@spec/contract";
import targets from "@spec/targets.json";
import { runAi } from "@/platform/ai";
import { DEFAULT_TIMEZONE, localDate } from "@/platform/dates";
import { reader, writer } from "@/platform/db";
import { ApiError, badRequest, conflict, notFound, notImplemented, unprocessable } from "@/platform/errors";
import { log } from "@/platform/log";
import * as preferences from "@/modules/preferences";
import { loadPlanningData, type PlanningData } from "./data";
import { findFeasibleSets, type DroppedPick, type FeasibleSet, type RelaxHint } from "./feasible";
import { optionalExtras, pastUseBy, type PastUseBy } from "./notes";
import { PLANNER_SYSTEM, expiringSoon, plannerContent, validateChoice } from "./planner";
import { buildShoppingList } from "./shopping";
import { findByKey, insertDraft, insertNextVersion, listSummaries, markSaved, readCurrent, readPlan } from "./store";

const DROP_REASON: Partial<Record<RelaxHint, string>> = {
  maxMinutes: "it takes longer than your max minutes",
  excludedIngredients: "it uses an ingredient you excluded",
  allergens: "it contains an allergen you filter out",
  equipment: "it needs equipment you don't have",
  preferences: "it goes against one of your confirmed preferences",
};

type PlanRequest = Pick<PlanCreate, "servings" | "budgetCents" | "maxMinutes" | "wishes">;

/**
 * Shared by createPlan and swapMeal: show the planner the top feasible sets, validate its choice,
 * and build the draft (meals with reasons, the set's shopping list, assumptions). Code decides which
 * fridge items and preferences belong to each meal.
 */
async function choosePlan(
  userId: string, requestId: string, data: PlanningData, input: PlanRequest,
  feasible: FeasibleSet[], droppedPicks: DroppedPick[], picks: string[],
): Promise<{ draft: Omit<PlanDraft, "planId" | "version" | "status">; run: RunInfo }> {
  if (!data.priceAsOf) throw new Error("planning: feasible sets exist but no product has a price date");
  const result = { droppedPicks };
  const sets = feasible.slice(0, targets.limits.plannerFeasibleSetsShown);
  const ingredientName = new Map(data.ingredients.map((i) => [i.id, i.name]));
  const ctx = {
    servings: input.servings,
    budgetCents: input.budgetCents,
    maxMinutes: input.maxMinutes,
    sets,
    recipes: data.recipes,
    expiring: expiringSoon(data.fridge, data.timezone, targets.limits.alertLeadDays).map((f) => ({ ...f, name: ingredientName.get(f.ingredientId) ?? f.ingredientId })),
    preferences: [...data.hardPreferences.map((p) => ({ ...p, kind: "hard" as const })), ...data.softPreferences.map((p) => ({ ...p, kind: "soft" as const }))],
    wishes: input.wishes,
    oneTimeNotes: data.oneTimeNotes,
    picked: picks.filter((id) => !result.droppedPicks.some((d) => d.recipeId === id)),
  };

  let lastViolations: string[] = [];
  let choice: PlannerChoice;
  let run: RunInfo;
  try {
    ({ output: choice, run } = await runAi({
      unit: "planner",
      userId,
      requestId,
      schema: PlannerChoice,
      system: PLANNER_SYSTEM,
      content: plannerContent(ctx),
      validate: (out) => (lastViolations = validateChoice(out, ctx)),
    }));
  } catch (err) {
    // Repairs used up on rule violations is plan_invalid (PLN5); provider errors stay as they are.
    if (err instanceof ApiError && err.status === 502 && lastViolations.length > 0) {
      throw new ApiError(502, "plan_invalid", "The planner did not return a valid plan", undefined, err.extra);
    }
    throw err;
  }

  const set = sets.find((s) => s.setId === choice.setId)!;
  const fridgeById = new Map(data.fridge.map((f) => [f.id, f]));
  const prefById = new Map(ctx.preferences.map((p) => [p.id, p]));
  const meals = set.recipeIds.map((recipeId) => {
    const recipe = data.recipes.find((r) => r.id === recipeId)!;
    const uses = new Set(recipe.ingredients.filter((i) => !i.optional).map((i) => `${i.ingredientId}|${i.unit}`));
    return {
      recipeId,
      title: recipe.title,
      reasons: choice.meals.find((m) => m.recipeId === recipeId)!.reasons.filter((r) => r.trim()),
      // Code decides which fridge items and preferences belong to which meal.
      usesFridgeItemIds: set.usesFridgeItemIds.filter((id) => {
        const f = fridgeById.get(id)!;
        return uses.has(`${f.ingredientId}|${f.unit}`);
      }),
      usesPreferenceIds: choice.usedPreferenceIds.filter((id) => {
        const scope = prefById.get(id)?.scopeRecipeId;
        return !scope || scope === recipeId;
      }),
    };
  });

  const draft = {
    servings: input.servings,
    budgetCents: input.budgetCents,
    meals,
    shopping: set.shopping,
    totalCents: set.totalCents,
    priceAsOf: data.priceAsOf!,
    assumptions: [
      `Prices are typical package prices checked on ${data.priceAsOf}; taxes are not included.`,
      "Fridge stock is what you confirmed in Cooky; staples you listed are assumed on hand.",
      ...result.droppedPicks.map((d) => `${data.recipes.find((r) => r.id === d.recipeId)!.title} was left out: ${DROP_REASON[d.because] ?? "it breaks one of your settings"}.`),
      ...choice.assumptions.filter((a) => a.trim()),
    ],
  };
  return { draft, run };
}

/** PLN1–PLN6: code finds and prices feasible sets, the planner picks one, the draft is stored. */
export async function createPlan(userId: string, input: z.infer<typeof PlanCreate>, requestId: string): Promise<{ plan: PlanDraft; run: RunInfo }> {
  const db = await reader();

  // PLN1: a repeat with the same key returns the original plan and costs nothing.
  const earlier = await findByKey(db, userId, input.idempotencyKey);
  if (earlier) return { plan: earlier.plan, run: { runId: earlier.runId ?? "none", terminated: "done", latencyMs: 0, costUsd: 0 } };

  const data = await loadPlanningData(db, userId);
  const mustUse = input.mustUseItemIds ?? [];
  if (mustUse.some((id) => !data.fridge.some((f) => f.id === id))) throw notFound();

  // Picked recipes (step 3): visible to this user, and no more of them than meals.
  const picks = [...new Set(input.mustIncludeRecipeIds ?? [])];
  if (picks.some((id) => !data.recipes.some((r) => r.id === id))) throw notFound();
  if (picks.length > input.meals) throw badRequest("invalid_input", `You picked ${picks.length} recipes for ${input.meals} meals`);

  const result = findFeasibleSets({
    ...data, servings: input.servings, budgetCents: input.budgetCents, maxMinutes: input.maxMinutes, meals: input.meals,
    mustUseItemIds: mustUse, mustIncludeRecipeIds: picks,
  });
  if (!result.ok) {
    throw unprocessable("infeasible", "No set of recipes fits these constraints", { cheapestFeasibleCents: result.cheapestFeasibleCents, relax: result.relax });
  }
  const { draft, run } = await choosePlan(userId, requestId, data, input, result.sets, result.droppedPicks, picks);
  const stored = await insertDraft(writer(userId), input, draft, run);
  if (stored) return { plan: stored, run };
  // Lost a race with a concurrent request using the same key: return that request's plan.
  const winner = await findByKey(db, userId, input.idempotencyKey);
  if (!winner) throw new Error("planning: idempotency conflict but no plan found for the key");
  return { plan: winner.plan, run };
}

export type PlanFormData = {
  defaults: { servings: number; budgetCents: number; maxMinutes: number; meals: number };
  fridgeItems: { id: string; name: string; qty: number; unit: string; expiresOn: string | null; pastUseBy: boolean }[];
  /** Recipes the user can pick to always include (curated and their own). */
  recipes: { id: string; title: string; minutes: number }[];
  recentPlans: z.infer<typeof PlanSummary>[];
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** What the /plan page needs: profile defaults (PLN1), fridge items to pin, and recent plans. */
export async function planFormData(userId: string): Promise<PlanFormData> {
  const db = await reader();
  const L = targets.limits;
  const [profileRes, fridgeRes, recipeRes, recentPlans] = await Promise.all([
    db.from("profiles").select("household_size, budget_cents_default, max_minutes_default, timezone").eq("user_id", userId).maybeSingle(),
    db.from("fridge_items").select("id, name, qty, unit, expires_on")
      .eq("user_id", userId).eq("status", "active").eq("kind", "ingredient").order("expires_on", { ascending: true }),
    db.from("recipes").select("id, title, minutes").or(`owner_id.is.null,owner_id.eq.${userId}`).order("title", { ascending: true }),
    listSummaries(db, userId),
  ]);
  if (profileRes.error) throw new Error(`planning: loading profile failed: ${profileRes.error.message}`);
  if (fridgeRes.error) throw new Error(`planning: loading fridge failed: ${fridgeRes.error.message}`);
  if (recipeRes.error) throw new Error(`planning: loading recipes failed: ${recipeRes.error.message}`);
  const p = profileRes.data as { household_size: number; budget_cents_default: number; max_minutes_default: number; timezone: string } | null;
  const today = localDate(p?.timezone || DEFAULT_TIMEZONE);
  return {
    // No profile yet: the database defaults (2 people, $40, 30 minutes).
    defaults: {
      servings: clamp(p?.household_size ?? 2, L.servingsMin, L.servingsMax),
      budgetCents: p?.budget_cents_default ?? 4000,
      maxMinutes: p?.max_minutes_default ?? 30,
      meals: clamp(3, L.mealsPerPlanMin, L.mealsPerPlanMax),
    },
    fridgeItems: ((fridgeRes.data ?? []) as { id: string; name: string; qty: number | string; unit: string; expires_on: string | null }[])
      .map((f) => ({ id: f.id, name: f.name, qty: Number(f.qty), unit: f.unit, expiresOn: f.expires_on, pastUseBy: f.expires_on !== null && f.expires_on < today })),
    recipes: ((recipeRes.data ?? []) as { id: string; title: string; minutes: number }[]).map((r) => ({ id: r.id, title: r.title, minutes: Number(r.minutes) })),
    recentPlans: recentPlans.slice(0, 5),
  };
}

/** What the plan page shows next to a plan, computed now: items past their typical use-by, optional extras. */
export async function planNotes(userId: string, plan: PlanDraft): Promise<{ today: string; pastUseBy: PastUseBy[]; extras: ShoppingList }> {
  const data = await loadPlanningData(await reader(), userId, plan.meals.map((m) => m.recipeId));
  const today = localDate(data.timezone);
  const names = new Map(data.ingredients.map((i) => [i.id, i.name]));
  return {
    today,
    pastUseBy: pastUseBy(plan, data.fridge, names, today),
    extras: optionalExtras(plan, data.recipes, data.ingredients, data.products, data.fridge, data.profile.stapleIngredientIds),
  };
}

export async function listPlans(userId: string): Promise<{ items: z.infer<typeof PlanSummary>[] }> {
  return { items: await listSummaries(await reader(), userId) };
}

export async function getPlan(userId: string, planId: string): Promise<PlanDraft> {
  return readPlan(await reader(), userId, planId);
}

/**
 * PLN7: swap one meal. The other meals stay (unless they now break a hard constraint), the slot is
 * refilled by the planner from code-checked sets, the whole list is recalculated, and the result
 * is a new draft version; earlier versions are untouched. The reason, if any, goes to the planner
 * for this swap and to preference_proposer (LRN1) as proposals the user can answer.
 */
export async function swapMeal(userId: string, planId: string, input: z.infer<typeof PlanSwap>, requestId: string): Promise<{ plan: PlanDraft; proposals: PreferenceProposal[]; run: RunInfo }> {
  const db = await reader();
  const { plan, inputs } = await readCurrent(db, userId, planId);
  if (input.baseVersion !== plan.version) throw conflict("stale_version", { currentVersion: plan.version });
  const out = plan.meals[input.mealIndex];
  if (!out) throw badRequest("invalid_input", `mealIndex ${input.mealIndex} is not a meal of this plan`);

  const all = await loadPlanningData(db, userId);
  const data = { ...all, recipes: all.recipes.filter((r) => r.id !== out.recipeId) };
  const keep = plan.meals.filter((_, i) => i !== input.mealIndex).map((m) => m.recipeId);
  const mustUse = (inputs.mustUseItemIds ?? []).filter((id) => data.fridge.some((f) => f.id === id));
  const reason = input.reason?.trim();

  const result = findFeasibleSets({
    ...data, servings: inputs.servings, budgetCents: inputs.budgetCents, maxMinutes: inputs.maxMinutes, meals: plan.meals.length,
    mustUseItemIds: mustUse, mustIncludeRecipeIds: keep,
  });
  if (!result.ok) throw unprocessable("no_alternative", "No other dish fits this plan's budget, time and preferences");

  const { draft, run } = await choosePlan(userId, requestId, data, { ...inputs, wishes: reason || inputs.wishes }, result.sets, result.droppedPicks, keep);
  // Kept meals keep the reasons the user already read; only the new dish gets a new one.
  const before = new Map(plan.meals.map((m) => [m.recipeId, m.reasons]));
  draft.meals = draft.meals.map((m) => (keep.includes(m.recipeId) && before.has(m.recipeId) ? { ...m, reasons: before.get(m.recipeId)! } : m));
  const stored = await insertNextVersion(writer(userId), planId, plan.version, inputs, draft, run);

  let proposals: PreferenceProposal[] = [];
  if (reason) {
    try {
      proposals = await preferences.propose(userId, reason, { recipeId: out.recipeId, requestId });
    } catch (err) {
      // The swap is already saved; a proposer failure only means no proposals to answer this time.
      log("swap_proposals_failed", { requestId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { plan: stored, proposals, run };
}

export async function savePlan(userId: string, planId: string, input: z.infer<typeof PlanSave>): Promise<{ planId: string; version: number; status: "saved" }> {
  return markSaved(await reader(), writer(userId), planId, input.version);
}

/** Join: price recipes for a user's fridge and servings (also used by Cook now and rescue ranking). */
export async function priceRecipes(userId: string, recipeIds: string[], servings: number): Promise<ShoppingList> {
  if (!Number.isInteger(servings) || servings <= 0) throw badRequest("invalid_input", "servings must be a positive integer");
  const ids = [...new Set(recipeIds)];
  const data = await loadPlanningData(await reader(), userId, ids);
  // Unknown or foreign recipe → 404 (RLS hides other users' imports, so both look the same).
  if (data.recipes.length !== ids.length) throw notFound();
  return buildShoppingList({
    servings,
    recipes: data.recipes,
    ingredients: data.ingredients,
    products: data.products,
    fridge: data.fridge,
    stapleIngredientIds: data.profile.stapleIngredientIds,
  });
}

// ---- v2
export async function setChecklist(userId: string, planId: string, input: z.infer<typeof ChecklistPatch>): Promise<{ checked: string[] }> {
  void userId;
  void planId;
  void input;
  throw notImplemented("planning.setChecklist (v2)");
}
