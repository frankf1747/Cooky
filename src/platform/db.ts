// Database clients (SPEC §9 access rule).
//   reader()        — the signed-in user's own session: RLS applies, SELECT only. Use for reads.
//   writer(userId)  — server-only, secret key, bypasses RLS. Use for every write, and always set
//                     user_id from the userId argument (the session), never from request input.
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { config } from "./config";

function need(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

export async function reader(): Promise<SupabaseClient> {
  const c = config();
  const store = await cookies();
  return createServerClient(need(c.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"), need(c.supabasePublishableKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        // Server Components cannot set cookies; proxy.ts refreshes the session on every request,
        // so a refresh attempted here is safe to drop. Route handlers can set them and do.
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          /* called from a Server Component */
        }
      },
    },
  });
}

let service: SupabaseClient | undefined;

export function writer(userId: string): { db: SupabaseClient; userId: string } {
  const c = config();
  service ??= createClient(need(c.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"), need(c.supabaseSecretKey, "SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db: service, userId };
}

/** The secret-key client for system jobs that act for no single user (webhook, cron, seed). */
export function systemWriter(): SupabaseClient {
  return writer("system").db;
}
