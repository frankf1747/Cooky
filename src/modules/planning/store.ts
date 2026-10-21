// Owner: Plan & Shop. Plans and their immutable versions (PLN1 idempotency, PLN6, PLN8).
// Reads go through the user's session (RLS) and filter by user; writes use writer(userId).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanCreate, PlanDraft, RunInfo } from "@spec/contract";
import { conflict, notFound } from "@/platform/errors";
import { newId } from "@/platform/ids";

type PlanRow = { id: string; status: "draft" | "saved"; current_version: number; created_at: string };
type VersionRow = {
  plan_id: string;
  version: number;
  inputs: PlanCreate;
  meals: PlanDraft["meals"];
  shopping: PlanDraft["shopping"];
  total_cents: number;
  price_as_of: string;
  assumptions: string[];
  run_id: string | null;
  saved_at: string | null;
};

const VERSION_COLS = "plan_id, version, inputs, meals, shopping, total_cents, price_as_of, assumptions, run_id, saved_at";

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`planning: ${what} failed: ${error?.message ?? "no row"}`);
}

function toDraft(plan: PlanRow, v: VersionRow): PlanDraft {
  return {
    planId: plan.id,
    version: v.version,
    status: v.saved_at ? "saved" : "draft",
    servings: v.inputs.servings,
    budgetCents: v.inputs.budgetCents,
    meals: v.meals,
    shopping: v.shopping,
    totalCents: v.total_cents,
    priceAsOf: String(v.price_as_of).slice(0, 10),
    assumptions: v.assumptions,
  };
}

async function currentVersion(db: SupabaseClient, userId: string, plan: PlanRow): Promise<VersionRow> {
  const res = await db.from("plan_versions").select(VERSION_COLS)
    .eq("user_id", userId).eq("plan_id", plan.id).eq("version", plan.current_version).maybeSingle();
  if (res.error || !res.data) fail(`reading version ${plan.current_version} of ${plan.id}`, res.error);
  return res.data as VersionRow;
}

/** A plan this user already created with this idempotency key, as it was first returned. */
export async function findByKey(db: SupabaseClient, userId: string, key: string): Promise<{ plan: PlanDraft; runId: string | null } | null> {
  const res = await db.from("plans").select("id, status, current_version, created_at")
    .eq("user_id", userId).eq("idempotency_key", key).maybeSingle();
  if (res.error) fail("idempotency lookup", res.error);
  if (!res.data) return null;
  const plan = res.data as PlanRow;
  const first = await db.from("plan_versions").select(VERSION_COLS).eq("user_id", userId).eq("plan_id", plan.id).eq("version", 1).maybeSingle();
  if (first.error || !first.data) fail(`reading version 1 of ${plan.id}`, first.error);
  return { plan: toDraft(plan, first.data as VersionRow), runId: (first.data as VersionRow).run_id };
}

/**
 * Store a new draft plan (version 1). Two inserts, so a failed version insert removes the plan row
 * rather than leaving a plan with no version. Returns null when another request with the same
 * idempotency key won the race; the caller then reads that one.
 */
export async function insertDraft(
  w: { db: SupabaseClient; userId: string },
  input: PlanCreate,
  draft: Omit<PlanDraft, "planId" | "version" | "status">,
  run: RunInfo,
): Promise<PlanDraft | null> {
  const planId = newId("pln");
  const p = await w.db.from("plans").insert({ id: planId, user_id: w.userId, status: "draft", current_version: 1, idempotency_key: input.idempotencyKey });
  if (p.error) {
    if ((p.error as { code?: string }).code === "23505") return null;
    fail("saving the plan", p.error);
  }
  const v = await w.db.from("plan_versions").insert({
    id: newId("plv"),
    plan_id: planId,
    user_id: w.userId,
    version: 1,
    inputs: input,
    meals: draft.meals,
    shopping: draft.shopping,
    total_cents: draft.totalCents,
    price_as_of: draft.priceAsOf,
    assumptions: draft.assumptions,
    run_id: run.runId,
  });
  if (v.error) {
    await w.db.from("plans").delete().eq("id", planId).eq("user_id", w.userId);
    fail("saving the plan version", v.error);
  }
  return { planId, version: 1, status: "draft", ...draft };
}

async function ownPlan(db: SupabaseClient, userId: string, planId: string): Promise<PlanRow> {
  const res = await db.from("plans").select("id, status, current_version, created_at").eq("user_id", userId).eq("id", planId).maybeSingle();
  if (res.error) fail(`reading ${planId}`, res.error);
  if (!res.data) throw notFound();
  return res.data as PlanRow;
}

export async function readPlan(db: SupabaseClient, userId: string, planId: string): Promise<PlanDraft> {
  const plan = await ownPlan(db, userId, planId);
  return toDraft(plan, await currentVersion(db, userId, plan));
}

export async function listSummaries(db: SupabaseClient, userId: string) {
  const res = await db.from("plans").select("id, status, current_version, created_at").eq("user_id", userId).order("created_at", { ascending: false });
  if (res.error) fail("listing plans", res.error);
  const plans = (res.data ?? []) as PlanRow[];
  if (plans.length === 0) return [];
  const vs = await db.from("plan_versions").select("plan_id, version, meals, total_cents").eq("user_id", userId).in("plan_id", plans.map((p) => p.id));
  if (vs.error) fail("listing plan versions", vs.error);
  const rows = (vs.data ?? []) as Pick<VersionRow, "plan_id" | "version" | "meals" | "total_cents">[];
  return plans.flatMap((p) => {
    const v = rows.find((r) => r.plan_id === p.id && r.version === p.current_version);
    return v ? [{ planId: p.id, status: p.status, version: p.current_version, createdAt: p.created_at, mealTitles: v.meals.map((m) => m.title), totalCents: v.total_cents }] : [];
  });
}

/** Save the current version. Saving it again is a no-op; any other version is stale (409). */
export async function markSaved(db: SupabaseClient, w: { db: SupabaseClient; userId: string }, planId: string, version: number) {
  const plan = await ownPlan(db, w.userId, planId);
  if (version !== plan.current_version) throw conflict("stale_version", { currentVersion: plan.current_version });
  if (plan.status !== "saved") {
    const v = await w.db.from("plan_versions").update({ saved_at: new Date().toISOString() })
      .eq("user_id", w.userId).eq("plan_id", planId).eq("version", version).is("saved_at", null);
    if (v.error) fail(`saving version ${version}`, v.error);
    const p = await w.db.from("plans").update({ status: "saved" }).eq("user_id", w.userId).eq("id", planId);
    if (p.error) fail(`saving ${planId}`, p.error);
  }
  return { planId, version, status: "saved" as const };
}
