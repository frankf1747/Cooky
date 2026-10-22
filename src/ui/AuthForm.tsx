"use client";
// Email + password sign-in and sign-up through Supabase Auth (SPEC ACC1).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/platform/db-browser";
import { alert, btnPrimary, btnText, field } from "./styles";
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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">Cooky</Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{mode === "login" ? "Log in" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {mode === "login" ? "Your fridge, plans and lists are where you left them." : "Free to start. Payments run in Stripe test mode, so nothing is charged."}
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input className={field} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input className={field} type="password" required minLength={PASSWORD_MIN_CHARS} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signup" && <span className="font-normal text-zinc-500">At least {PASSWORD_MIN_CHARS} characters.</span>}
        </label>
        {error && <p role="alert" className={alert}>{error}</p>}
        {notice && <p className="rounded-lg bg-accent-soft p-3 text-sm">{notice}</p>}
        <button disabled={busy} className={`mt-1 ${btnPrimary}`}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {mode === "login" ? (
          <>
            New here? <Link className={btnText} href="/signup">Create an account</Link>
            <span className="mt-2 block"><Link className={btnText} href="/forgot-password">Forgot your password?</Link></span>
          </>
        ) : (
          <>Already have an account? <Link className={btnText} href="/login">Log in</Link></>
        )}
      </p>
    </main>
  );
}
