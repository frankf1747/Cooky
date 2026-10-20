// Who is calling. The only place a user id comes from (AGENTS.md: never from the body or query).
import { reader } from "./db";
import { unavailable, upstream } from "./errors";
import { log } from "./log";

export type SessionUser = { id: string; email: string };

/**
 * The signed-in user, or null when there is no valid session (no cookie, expired or invalid
 * token). If the auth service itself cannot be reached, this throws 503 rather than pretending
 * the user is signed out (fail loud).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const db = await reader();
  const { data, error } = await db.auth.getClaims();
  if (error) {
    const status = (error as { status?: number }).status ?? 0;
    if (error.name === "AuthRetryableFetchError" || status === 0 || status >= 500) {
      log("auth_error", { name: error.name, status, error: error.message });
      throw unavailable("auth_unavailable", "The sign-in service is unavailable; try again");
    }
    return null;
  }
  if (!data?.claims?.sub) return null;
  return { id: data.claims.sub, email: String(data.claims.email ?? "") };
}

export async function isPro(userId: string): Promise<boolean> {
  const db = await reader();
  const { data, error } = await db.from("entitlements").select("plan").eq("user_id", userId).maybeSingle();
  if (error) throw upstream("db_error", `entitlement lookup failed: ${error.message}`);
  return data?.plan === "pro";
}
