// Email-confirmation link target: exchange the one-time code for a session, then go to onboarding.
import { NextResponse } from "next/server";
import { reader } from "@/platform/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await reader()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/onboarding", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
