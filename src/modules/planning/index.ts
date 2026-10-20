// Owner: Plan & Shop. Feasible sets, shopping math, the planner, saved plans (SPEC §5.3).
// Shopping math lives in shopping.ts (create it) and is pure code: the model never does arithmetic.
import type { z } from "zod";
import type { ChecklistPatch, PlanCreate, PlanDraft, PlanSave, PlanSummary, PlanSwap, PreferenceProposal, RunInfo, ShoppingList } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function createPlan(userId: string, input: z.infer<typeof PlanCreate>, requestId: string): Promise<{ plan: PlanDraft; run: RunInfo }> {
  void userId;
  void input;
  void requestId;
  throw notImplemented("planning.createPlan");
}

export async function listPlans(userId: string): Promise<{ items: z.infer<typeof PlanSummary>[] }> {
  void userId;
  throw notImplemented("planning.listPlans");
}

export async function getPlan(userId: string, planId: string): Promise<PlanDraft> {
  void userId;
  void planId;
  throw notImplemented("planning.getPlan");
}

export async function swapMeal(userId: string, planId: string, input: z.infer<typeof PlanSwap>, requestId: string): Promise<{ plan: PlanDraft; proposals: PreferenceProposal[]; run: RunInfo }> {
  void userId;
  void planId;
  void input;
  void requestId;
  throw notImplemented("planning.swapMeal");
}

export async function savePlan(userId: string, planId: string, input: z.infer<typeof PlanSave>): Promise<{ planId: string; version: number; status: "saved" }> {
  void userId;
  void planId;
  void input;
  throw notImplemented("planning.savePlan");
}

/** Join: price recipes for a user's fridge and servings (also used by Cook now and rescue ranking). */
export async function priceRecipes(userId: string, recipeIds: string[], servings: number): Promise<ShoppingList> {
  void userId;
  void recipeIds;
  void servings;
  throw notImplemented("planning.priceRecipes");
}

// ---- v2
export async function setChecklist(userId: string, planId: string, input: z.infer<typeof ChecklistPatch>): Promise<{ checked: string[] }> {
  void userId;
  void planId;
  void input;
  throw notImplemented("planning.setChecklist (v2)");
}
