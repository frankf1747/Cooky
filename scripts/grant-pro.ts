// LOCAL DEVELOPMENT ONLY: give a local test account Pro, so features behind Pro can be built before
// billing lands. Refuses to run against anything but a local Supabase. Real Pro comes only from the
// Stripe webhook (SPEC ACC6).
//   npm run dev:grant-pro -- you@example.com
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isLocalSupabase } from "./local-only";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const email = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!email) throw new Error("usage: npm run dev:grant-pro -- <email of a local account>");
  if (!isLocalSupabase(url)) throw new Error(`refusing: ${url ?? "NEXT_PUBLIC_SUPABASE_URL"} is not a local Supabase`);
  const db = createClient(url!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`no local account for ${email}: sign up at http://localhost:3000/signup first`);
  const { error: e } = await db.from("entitlements").upsert({ user_id: user.id, plan: "pro", granted_at: new Date().toISOString() });
  if (e) throw new Error(e.message);
  console.log(`grant-pro: ${email} is Pro on the local database`);
}
main().catch((err) => {
  console.log(`grant-pro: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
