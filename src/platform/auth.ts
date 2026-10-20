// Who is calling. The only place a user id comes from (AGENTS.md: never from the body or query).
import { reader } from "./db";
import { upstream } from "./errors";

export type SessionUser = { id: string; email: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const db = await reader();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: String(data.claims.email ?? "") };
}

export async function isPro(userId: string): Promise<boolean> {
  const db = await reader();
  const { data, error } = await db.from("entitlements").select("plan").eq("user_id", userId).maybeSingle();
  if (error) throw upstream("db_error", `entitlement lookup failed: ${error.message}`);
  return data?.plan === "pro";
}
