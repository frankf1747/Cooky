"use client";
// Email + password sign-in and sign-up through Supabase Auth (SPEC ACC1).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/platform/db-browser";
import { PASSWORD_MIN_CHARS } from "./password";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = browserClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    if (mode === "signup" && !result.data.session) return setNotice("Check your email to confirm your account, then log in.");
    // Until the profile is saved, send the user to onboarding (journey step 1).
    let next = "/onboarding";
    if (mode === "login") {
      const me = await fetch("/api/me").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      next = me?.onboarded === false ? "/onboarding" : "/home";
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Log in to Cooky" : "Create your Cooky account"}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" type="password" required minLength={PASSWORD_MIN_CHARS} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
        <button disabled={busy} className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-500">
        {mode === "login" ? (
          <>
            New here? <Link className="underline" href="/signup">Create an account</Link>
            <span className="mt-2 block"><Link className="underline" href="/forgot-password">Forgot your password?</Link></span>
          </>
        ) : (
          <>Already have an account? <Link className="underline" href="/login">Log in</Link></>
        )}
      </p>
    </main>
  );
}
