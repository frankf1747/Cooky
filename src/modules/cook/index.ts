// Owner: Recipes & Cook. Cook mode, deductions and the cooking assistant (SPEC §5.6, §5.7).
import type { z } from "zod";
import targets from "@spec/targets.json";
import {
  CookAnswerOutput,
  type BatchEvent,
  type CookAnswer,
  type CookAsk,
  type CookConfirm,
  type CookConfirmResponse,
  type CookDone,
  type CookDoneResponse,
  type Deduction,
  type PreferenceProposal,
  type Recipe,
} from "@spec/contract";
import { runAi } from "@/platform/ai";
import { DEFAULT_TIMEZONE, localDate } from "@/platform/dates";
import { reader, writer } from "@/platform/db";
import { ApiError, badRequest, notFound, upstream } from "@/platform/errors";
import { newId } from "@/platform/ids";
import { tierAndTimezone } from "@/platform/quotas";
import { log } from "@/platform/log";
import * as fridge from "@/modules/fridge";
import * as preferences from "@/modules/preferences";
import * as recipes from "@/modules/recipes";
import { SYSTEM, finalize, isSafetyTopic, userContent, violations, type Turn } from "./assistant";

type DoneResponse = z.infer<typeof CookDoneResponse>;
type ConfirmResponse = z.infer<typeof CookConfirmResponse>;

function dbFail(what: string, error: { message: string } | null): void {
  if (error) throw upstream("db_error", `cook: ${what} failed: ${error.message}`);
}

/** YYYY-MM-DD in the user's timezone, `days` from today. */
function localDatePlus(tz: string, days: number): string {
  const d = new Date(`${localDate(tz)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- cook page (CK1)

/** What the cook page needs: the recipe, whether the assistant is unlocked, and default servings. */
export async function pageData(userId: string, recipeId: string): Promise<{ recipe: Recipe; pro: boolean; servings: number }> {
  const [recipe, { plan }, db] = await Promise.all([recipes.get(userId, recipeId), tierAndTimezone(userId), reader()]);
  const res = await db.from("profiles").select("household_size").eq("user_id", userId).maybeSingle();
  dbFail("loading the profile", res.error);
  const household = Number((res.data as { household_size?: number } | null)?.household_size) || recipe.baseServings;
  const servings = Math.min(targets.limits.servingsMax, Math.max(targets.limits.servingsMin, household));
  return { recipe, pro: plan === "pro", servings };
}

// ---------------------------------------------------------------- assistant (ASK1–ASK5)

/** Last `limits.cookHistoryTurns` exchanges of this session, oldest first. */
async function history(userId: string, sessionId: string): Promise<Turn[]> {
  const db = await reader();
  const res = await db.from("cook_messages").select("role, text, id").eq("session_id", sessionId).eq("user_id", userId).order("id", { ascending: true });
  dbFail("loading the conversation", res.error);
  const rows = (res.data ?? []) as { role: Turn["role"]; text: string }[];
  return rows.slice(-2 * targets.limits.cookHistoryTurns).map((r) => ({ role: r.role, text: r.text }));
}

export async function ask(userId: string, recipeId: string, input: z.infer<typeof CookAsk>, requestId: string): Promise<CookAnswer> {
  const recipe = await recipes.get(userId, recipeId); // 404 unless curated or the user's own (ASK1)
  const { db: w } = writer(userId);

  let sessionId = input.sessionId;
  if (sessionId) {
    const db = await reader();
    const res = await db.from("cook_sessions").select("id, recipe_id").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    dbFail("loading the cook session", res.error);
    if (!res.data || (res.data as { recipe_id: string }).recipe_id !== recipeId) throw notFound();
  } else {
    sessionId = newId("cks");
    const { error } = await w.from("cook_sessions").insert({ id: sessionId, user_id: userId, recipe_id: recipeId });
    dbFail("starting a cook session", error);
  }

  const [chunks, turns] = await Promise.all([recipes.retrieveChunks(recipeId, input.question), history(userId, sessionId)]);
  const { output, run } = await runAi({
    unit: "cook_assistant",
    userId,
    requestId,
    schema: CookAnswerOutput,
    system: SYSTEM,
    content: [{ type: "text", text: userContent(recipe.title, chunks, turns, input.question) }],
    validate: (out) => violations(out, chunks),
    maxTokens: 600,
  });
  const answer = finalize(output, chunks, isSafetyTopic(input.question));
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const citations = answer.citations.map((id) => {
    const c = byId.get(id)!;
    return { chunkId: c.id, kind: c.kind, label: c.label };
  });

  const { error } = await w.from("cook_messages").insert([
    { session_id: sessionId, user_id: userId, role: "user", text: input.question, citations: [], run_id: null },
    { session_id: sessionId, user_id: userId, role: "assistant", text: answer.answer, citations, run_id: run.runId },
  ]);
  dbFail("saving the conversation", error);

  return { ...answer, citations, sessionId, run };
}

// ---------------------------------------------------------------- done and confirm (CK2–CK3)

type ProfileRow = { household_size: number | null; timezone: string | null };

/**
 * Cook *Done* (CK2): proposed deductions from the fridge (Fridge's join, oldest use-by first), the
 * ingredients with no stock at all, and a leftovers dish for servings beyond the household. Writes
 * only the proposal; the fridge does not change.
 */
export async function done(userId: string, recipeId: string, input: z.infer<typeof CookDone>): Promise<DoneResponse> {
  const recipe = await recipes.get(userId, recipeId);
  const db = await reader();
  if (input.planId) {
    const plan = await db.from("plans").select("id").eq("id", input.planId).eq("user_id", userId).maybeSingle();
    dbFail("loading the plan", plan.error);
    if (!plan.data) throw notFound();
  }
  const [deductions, profileRes, catRes] = await Promise.all([
    fridge.proposeDeductions(userId, recipeId, input.servings),
    db.from("profiles").select("household_size, timezone").eq("user_id", userId).maybeSingle(),
    db.from("category_defaults").select("category, shelf_life_days").eq("category", "prepared").maybeSingle(),
  ]);
  dbFail("loading the profile", profileRes.error);
  dbFail("loading leftover shelf life", catRes.error);
  const profile = profileRes.data as ProfileRow | null;
  const leftoverDays = (catRes.data as { shelf_life_days: { fridge?: number } } | null)?.shelf_life_days?.fridge;
  if (!leftoverDays) throw upstream("db_error", "cook: no fridge shelf life for the prepared category in category_defaults");

  // A Deduction needs a fridge item, so ingredients with no stock at all are listed separately.
  const covered = new Set(deductions.map((d) => d.ingredientId));
  const missing = recipe.ingredients
    .filter((i) => !i.optional && !covered.has(i.ingredientId))
    .map((i) => ({ ingredientId: i.ingredientId, qty: (i.qty * input.servings) / recipe.baseServings, unit: i.unit }));

  const household = profile?.household_size ?? recipe.baseServings;
  const leftovers = { servings: Math.max(0, input.servings - household), expiresOn: localDatePlus(profile?.timezone || DEFAULT_TIMEZONE, leftoverDays) };

  const cookEventId = newId("cke");
  const proposal = { deductions, missing, leftovers, recipeTitle: recipe.title };
  const { error } = await writer(userId).db.from("cook_events").insert({
    id: cookEventId,
    user_id: userId,
    recipe_id: recipeId,
    plan_id: input.planId ?? null,
    servings: input.servings,
    status: "proposed",
    proposal,
  });
  dbFail("saving the cook event", error);
  return { cookEventId, deductions, missing, leftovers };
}

type EventRow = {
  id: string;
  recipe_id: string;
  status: "proposed" | "confirmed";
  proposal: { deductions: Deduction[]; leftovers: { servings: number; expiresOn: string }; recipeTitle: string };
  confirm_result: ConfirmResponse | null;
};

/**
 * Confirm (CK3): apply the user's edited deductions and leftovers as one fridge batch keyed by the
 * cook event id, so a repeat writes nothing and returns the first result. Pro users' feedback goes
 * to preference proposals (never saved here); Free users' feedback is only stored.
 */
export async function confirm(userId: string, cookEventId: string, input: z.infer<typeof CookConfirm>, requestId: string): Promise<ConfirmResponse> {
  const db = await reader();
  const res = await db.from("cook_events").select("id, recipe_id, status, proposal, confirm_result").eq("id", cookEventId).eq("user_id", userId).maybeSingle();
  dbFail("loading the cook event", res.error);
  const event = res.data as EventRow | null;
  if (!event) throw notFound();
  if (event.status === "confirmed" && event.confirm_result) return event.confirm_result;

  // Only items Cooky proposed may be deducted; the user may lower, raise or drop each amount.
  const proposed = new Map(event.proposal.deductions.map((d) => [d.itemId, d]));
  const seen = new Set<string>();
  for (const d of input.deductions) {
    if (!proposed.has(d.itemId) || seen.has(d.itemId)) throw badRequest("invalid_input", `Item ${d.itemId} was not proposed for this dish`);
    seen.add(d.itemId);
  }
  const events: BatchEvent[] = input.deductions.filter((d) => d.qty > 0).map((d) => ({ itemId: d.itemId, delta: -d.qty, reason: "cook" }));
  const leftoverServings = input.leftoverServings ?? 0;
  if (leftoverServings > 0) {
    events.push({
      itemId: null,
      delta: leftoverServings,
      reason: "cook",
      newItem: {
        kind: "dish",
        ingredientId: null,
        recipeId: event.recipe_id,
        name: `${event.proposal.recipeTitle} (leftovers)`,
        category: "prepared",
        qty: leftoverServings,
        unit: "count",
        location: "fridge",
        expiresOn: event.proposal.leftovers.expiresOn,
        expirySource: "category",
        origin: "cooked",
      },
    });
  }

  // insufficient_stock (409) and every other fridge error propagate unchanged.
  const fridgeView = events.length ? (await fridge.applyBatch(userId, events, cookEventId)).fridge : await fridge.view(userId);

  let proposals: PreferenceProposal[] = [];
  const feedback = input.feedback?.trim();
  if (feedback) {
    if ((await tierAndTimezone(userId)).plan === "pro") {
      try {
        proposals = await preferences.propose(userId, feedback, { recipeId: event.recipe_id, requestId });
      } catch (err) {
        // Preferences (LRN1–LRN3) may not be built yet. The fridge is already updated and the
        // feedback is stored below, so report no proposals rather than failing the confirm.
        if (!(err instanceof ApiError && err.status === 501)) throw err;
        log("cook_feedback_without_proposals", { requestId, reason: "preferences.propose not implemented" });
      }
    }
  }

  const result: ConfirmResponse = { fridge: fridgeView, proposals, run: null };
  const { error } = await writer(userId)
    .db.from("cook_events")
    .update({ status: "confirmed", confirm_result: result, rating: input.rating ?? null, feedback: feedback || null })
    .eq("id", cookEventId)
    .eq("user_id", userId);
  dbFail("saving the confirmation", error);
  return result;
}
