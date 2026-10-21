// "Today" for a user (SPEC FRG2, FRG3, RCT3): the local calendar date in their profile timezone.
// Use localToday(userId) for added dates, expiry dates and "expiring soon", never the server's date.
import { reader } from "./db";
import { upstream } from "./errors";

/** The profiles.timezone column default (init migration), for users with no profile row yet. */
export const DEFAULT_TIMEZONE = "America/Los_Angeles";

/** YYYY-MM-DD in a timezone at an instant. */
export function localDate(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** The user's timezone, read through their own session (RLS applies). */
export async function userTimezone(userId: string): Promise<string> {
  const db = await reader();
  const { data, error } = await db.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  if (error) throw upstream("db_error", `profile lookup failed: ${error.message}`);
  return (data?.timezone as string | undefined) || DEFAULT_TIMEZONE;
}

/** Today's date for this user, in their timezone. */
export async function localToday(userId: string, now = new Date()): Promise<string> {
  return localDate(await userTimezone(userId), now);
}
