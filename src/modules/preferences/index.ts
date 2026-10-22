// Owner: Plan & Shop. Confirmed preferences and AI proposals (SPEC §5.9, LRN1–LRN3).
// The model only proposes; a preference exists only after the user taps *Always* (LRN2).
import type { z } from "zod";
import { PreferenceProposalsOutput, type Preference, type PreferenceCreate, type PreferencePatch, type PreferenceProposal } from "@spec/contract";
import { runAi } from "@/platform/ai";
import { reader, writer } from "@/platform/db";
import { notFound } from "@/platform/errors";
import { newId } from "@/platform/ids";
import { PROPOSER_SYSTEM, proposerContent, shapeProposals, validateProposals } from "./proposer";

type PrefRow = { id: string; kind: Preference["kind"]; category: Preference["category"]; value: string; scope_recipe_id: string | null; confirmed_at: string; active: boolean };
type ProposalRow = { id: string; kind: PreferenceProposal["kind"]; category: PreferenceProposal["category"]; value: string; reason: string; scope_recipe_id: string | null; source: string; status: "pending" | "accepted" | "once" | "dismissed" };

const PREF_COLS = "id, kind, category, value, scope_recipe_id, confirmed_at, active";

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`preferences: ${what} failed: ${error?.message ?? "no row"}`);
}

const toPreference = (r: PrefRow): Preference => ({
  id: r.id, kind: r.kind, category: r.category, value: r.value, scopeRecipeId: r.scope_recipe_id, confirmedAt: r.confirmed_at, active: r.active,
});

async function ownPreference(userId: string, preferenceId: string): Promise<PrefRow> {
  const res = await (await reader()).from("preferences").select(PREF_COLS).eq("user_id", userId).eq("id", preferenceId).maybeSingle();
  if (res.error) fail(`reading ${preferenceId}`, res.error);
  if (!res.data) throw notFound();
  return res.data as PrefRow;
}

/** LRN3: every preference of this user, newest first, active or paused. */
export async function list(userId: string): Promise<{ items: Preference[] }> {
  const res = await (await reader()).from("preferences").select(PREF_COLS).eq("user_id", userId).order("confirmed_at", { ascending: false });
  if (res.error) fail("listing preferences", res.error);
  return { items: ((res.data ?? []) as PrefRow[]).map(toPreference) };
}

/**
 * LRN2: answer a proposal (*Always* writes an active preference; *Just this time* applies to the
 * next plan only; *Don't save* keeps nothing), or add a preference typed on the Preferences page.
 * Answering the same proposal twice returns the first answer's result.
 */
export async function create(userId: string, input: z.infer<typeof PreferenceCreate>): Promise<{ preferenceId: string | null }> {
  const w = writer(userId);
  if (!("proposalId" in input)) {
    const id = newId("prf");
    const res = await w.db.from("preferences").insert({
      id, user_id: userId, kind: input.kind, category: input.category, value: input.value.trim(),
      scope_recipe_id: null, source_request_id: null, confirmed_at: new Date().toISOString(), active: true,
    });
    if (res.error) fail("saving the preference", res.error);
    return { preferenceId: id };
  }

  const db = await reader();
  const res = await db.from("preference_proposals").select("id, kind, category, value, reason, scope_recipe_id, source, status")
    .eq("user_id", userId).eq("id", input.proposalId).maybeSingle();
  if (res.error) fail(`reading ${input.proposalId}`, res.error);
  if (!res.data) throw notFound();
  const p = res.data as ProposalRow;

  if (p.status !== "pending") {
    // Already answered: the first answer stands (a double tap or a retry must not add a second preference).
    if (p.status !== "accepted") return { preferenceId: null };
    const prior = await db.from("preferences").select("id").eq("user_id", userId).eq("source_request_id", p.source)
      .eq("category", p.category).eq("value", p.value).maybeSingle();
    if (prior.error) fail("reading the saved preference", prior.error);
    return { preferenceId: (prior.data as { id: string } | null)?.id ?? null };
  }

  // Claim the proposal first: only the request that moves it out of "pending" goes on to save.
  const status = input.scope === "always" ? "accepted" : input.scope === "once" ? "once" : "dismissed";
  const claim = await w.db.from("preference_proposals").update({ status })
    .eq("user_id", userId).eq("id", p.id).eq("status", "pending").select("id");
  if (claim.error) fail(`answering ${p.id}`, claim.error);
  if (!claim.data?.length) return create(userId, input); // answered meanwhile: return that answer

  let preferenceId: string | null = null;
  if (input.scope === "always") {
    preferenceId = newId("prf");
    const ins = await w.db.from("preferences").insert({
      id: preferenceId, user_id: userId, kind: p.kind, category: p.category, value: p.value, scope_recipe_id: p.scope_recipe_id,
      source_request_id: p.source, confirmed_at: new Date().toISOString(), active: true,
    });
    if (ins.error) {
      // Give the proposal back so the user can answer again; never leave "accepted" with no preference.
      await w.db.from("preference_proposals").update({ status: "pending" }).eq("user_id", userId).eq("id", p.id);
      fail("saving the preference", ins.error);
    }
  }
  return { preferenceId };
}

/** LRN3: edit the wording, or pause and resume a preference. */
export async function update(userId: string, preferenceId: string, input: z.infer<typeof PreferencePatch>): Promise<Preference> {
  const row = await ownPreference(userId, preferenceId);
  const patch: Partial<PrefRow> = {};
  if (input.value !== undefined) patch.value = input.value.trim();
  if (input.active !== undefined) patch.active = input.active;
  if (Object.keys(patch).length) {
    const res = await writer(userId).db.from("preferences").update(patch).eq("user_id", userId).eq("id", preferenceId);
    if (res.error) fail(`updating ${preferenceId}`, res.error);
  }
  return toPreference({ ...row, ...patch });
}

/** LRN3: delete one of the user's own preferences. */
export async function remove(userId: string, preferenceId: string): Promise<void> {
  await ownPreference(userId, preferenceId);
  const res = await writer(userId).db.from("preferences").delete().eq("user_id", userId).eq("id", preferenceId);
  if (res.error) fail(`deleting ${preferenceId}`, res.error);
}

/**
 * Join used by planning.swapMeal and cook.confirm (LRN1): turn the user's words into proposals.
 * They are stored as pending; nothing is a preference until the user answers (create).
 */
export async function propose(userId: string, text: string, context: { recipeId: string | null; requestId: string }): Promise<PreferenceProposal[]> {
  const words = text.trim();
  if (!words) return [];
  let recipeTitle: string | null = null;
  if (context.recipeId) {
    const r = await (await reader()).from("recipes").select("title").eq("id", context.recipeId).maybeSingle();
    if (r.error) fail("reading the recipe", r.error);
    recipeTitle = (r.data as { title: string } | null)?.title ?? null;
  }

  const { output } = await runAi({
    unit: "preference_proposer",
    userId,
    requestId: context.requestId,
    schema: PreferenceProposalsOutput,
    system: PROPOSER_SYSTEM,
    content: proposerContent(words, recipeTitle),
    validate: validateProposals,
  });

  const shaped = shapeProposals(output.proposals, context.recipeId);
  if (shaped.length === 0) return [];
  const rows = shaped.map((p) => ({ ...p, id: newId("prp") }));
  const res = await writer(userId).db.from("preference_proposals").insert(rows.map((p) => ({
    id: p.id, user_id: userId, kind: p.kind, category: p.category, value: p.value, reason: p.reason,
    scope_recipe_id: p.scopeRecipeId, source: context.requestId, status: "pending",
  })));
  if (res.error) fail("saving proposals", res.error);
  return rows;
}

/** Titles for recipe-scoped preferences, for the Preferences page ("only in Lemon chicken"). */
export async function recipeTitles(recipeIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(recipeIds)];
  if (ids.length === 0) return {};
  const res = await (await reader()).from("recipes").select("id, title").in("id", ids);
  if (res.error) fail("reading recipe titles", res.error);
  return Object.fromEntries(((res.data ?? []) as { id: string; title: string }[]).map((r) => [r.id, r.title]));
}
