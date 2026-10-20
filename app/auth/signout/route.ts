import { NextResponse } from "next/server";
import { reader } from "@/platform/db";

export async function POST(request: Request) {
  await (await reader()).auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
