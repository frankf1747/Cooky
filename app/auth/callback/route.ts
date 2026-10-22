// Email link target (sign-up confirmation, password reset): exchange the one-time code for a
// session, then go to `next` (a path on this site; onboarding by default).
import { NextResponse } from "next/server";
import { reader } from "@/platform/db";
import { safeNext } from "./next";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const { error } = await (await reader()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(next === "/reset-password" ? "/forgot-password?error=expired" : "/login?error=confirmation", url.origin));
}
