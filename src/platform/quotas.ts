// Per-user quotas (SPEC G4, targets.json → quotas). Free counts are lifetime; Pro counts reset at
// local midnight. Check-and-increment is one atomic Postgres call (consume_quota), done before
// any model call so two simultaneous requests cannot both slip under the limit.
import targets from "@spec/targets.json";
import { forbidden, tooMany, upstream } from "./errors";
import { writer } from "./db";

export type QuotaFeature = "plans" | "swaps" | "receipts" | "imports" | "cook_answers" | "preference_proposals";
export type Tier = "free" | "pro";

const DEFAULT_TZ = "America/Los_Angeles";

export function quotaLimit(feature: QuotaFeature, plan: Tier): number {
  const table = plan === "free" ? (targets.quotas.free as Record<string, number>) : (targets.quotas.pro as Record<string, number>);
  return table[plan === "free" ? `${feature}_lifetime` : `${feature}_per_day`] ?? 0;
}

function localDate(tz: string, at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function quotaPeriod(plan: Tier, tz: string, now = new Date()): { period: string; resetAt: string | null } {
  if (plan === "free") return { period: "lifetime", resetAt: null };
  const today = localDate(tz, now);
  const [y, m, d] = today.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { period: today, resetAt: `${next}T00:00:00[${tz}]` };
}

/** The user's tier and timezone, read with the server writer (entitlements are not client-writable). */
export async function tierAndTimezone(userId: string): Promise<{ plan: Tier; tz: string }> {
  const { db } = writer(userId);
  const [ent, prof] = await Promise.all([
    db.from("entitlements").select("plan").eq("user_id", userId).maybeSingle(),
    db.from("profiles").select("timezone").eq("user_id", userId).maybeSingle(),
  ]);
  if (ent.error) throw upstream("db_error", `entitlement lookup failed: ${ent.error.message}`);
  if (prof.error) throw upstream("db_error", `profile lookup failed: ${prof.error.message}`);
  return { plan: ent.data?.plan === "pro" ? "pro" : "free", tz: prof.data?.timezone || DEFAULT_TZ };
}

/** Atomically count one use. Throws 403 not_pro (Free limit reached) or 429 (Pro daily limit). */
export async function consumeQuota(userId: string, feature: QuotaFeature): Promise<{ used: number; limit: number; resetAt: string | null }> {
  const { plan, tz } = await tierAndTimezone(userId);
  const limit = quotaLimit(feature, plan);
  if (limit <= 0) throw forbidden("not_pro", "Cooky Pro required");
  const { period, resetAt } = quotaPeriod(plan, tz);
  const { db } = writer(userId);
  const { data, error } = await db.rpc("consume_quota", { p_user: userId, p_feature: feature, p_period: period, p_limit: limit });
  if (error) throw upstream("db_error", `quota check failed: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { used: number; allowed: boolean } | undefined;
  if (!row?.allowed) {
    if (plan === "free") throw forbidden("not_pro", "Free limit reached: unlock Cooky Pro for more");
    throw tooMany(resetAt ?? "");
  }
  return { used: row.used, limit, resetAt };
}
