// Per-user quotas (SPEC G4, targets.json → quotas). Free counts are lifetime; Pro counts reset at
// local midnight. Check-and-increment is one atomic Postgres call (consume_quota), done before
// any model call so two simultaneous requests cannot both slip under the limit.
import targets from "@spec/targets.json";
import { forbidden, tooMany, upstream } from "./errors";
import { reader, writer } from "./db";
import { DEFAULT_TIMEZONE, localDate } from "./dates";

export const QUOTA_FEATURES = ["plans", "swaps", "receipts", "imports", "cook_answers", "preference_proposals"] as const;
export type QuotaFeature = (typeof QUOTA_FEATURES)[number];
export type Tier = "free" | "pro";

export function quotaLimit(feature: QuotaFeature, plan: Tier): number {
  const table = plan === "free" ? (targets.quotas.free as Record<string, number>) : (targets.quotas.pro as Record<string, number>);
  return table[plan === "free" ? `${feature}_lifetime` : `${feature}_per_day`] ?? 0;
}

/** Milliseconds the zone is ahead of UTC at a given instant (negative west of Greenwich). */
function zoneOffsetMs(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant of 00:00 local time on a local date (YYYY-MM-DD), DST-aware. */
function localMidnightUtc(date: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - zoneOffsetMs(tz, new Date(guess));
  t = guess - zoneOffsetMs(tz, new Date(t)); // re-check with the offset in force at that instant
  return new Date(t);
}

export function quotaPeriod(plan: Tier, tz: string, now = new Date()): { period: string; resetAt: string | null } {
  if (plan === "free") return { period: "lifetime", resetAt: null };
  const today = localDate(tz, now);
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { period: today, resetAt: localMidnightUtc(tomorrow, tz).toISOString() };
}

/** The user's tier and timezone, read through their own session (RLS applies). */
export async function tierAndTimezone(userId: string): Promise<{ plan: Tier; tz: string }> {
  const db = await reader();
  const [ent, prof] = await Promise.all([
    db.from("entitlements").select("plan").eq("user_id", userId).maybeSingle(),
    db.from("profiles").select("timezone").eq("user_id", userId).maybeSingle(),
  ]);
  if (ent.error) throw upstream("db_error", `entitlement lookup failed: ${ent.error.message}`);
  if (prof.error) throw upstream("db_error", `profile lookup failed: ${prof.error.message}`);
  return { plan: ent.data?.plan === "pro" ? "pro" : "free", tz: prof.data?.timezone || DEFAULT_TIMEZONE };
}

export type QuotaUse = { used: number; limit: number; resetAt: string | null; release: () => Promise<void> };

/**
 * Atomically count one use. Throws 403 not_pro (Free limit reached) or 429 (Pro daily limit).
 * Call `release()` if the work then fails, so a failed attempt does not cost the user a use.
 */
export async function consumeQuota(userId: string, feature: QuotaFeature): Promise<QuotaUse> {
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
  const release = async () => {
    const { error: e } = await db.rpc("release_quota", { p_user: userId, p_feature: feature, p_period: period });
    if (e) throw upstream("db_error", `quota release failed: ${e.message}`);
  };
  return { used: row.used, limit, resetAt, release };
}
