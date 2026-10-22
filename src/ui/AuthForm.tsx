"use client";
// Email + password sign-in and sign-up through Supabase Auth (SPEC ACC1).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/platform/db-browser";
import { AuthBao, type AuthAttention } from "./AuthBao";
import { AuthShell } from "./AuthShell";
import { alert, btnPrimary, btnText, field, label, notice as noticeBox } from "./styles";
import { PASSWORD_MIN_CHARS } from "./password";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attention, setAttention] = useState<AuthAttention>("none");
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
    <AuthShell
      title={mode === "login" ? "Welcome back" : "Create your account"}
      lead={mode === "login" ? "Your fridge is where you left it." : "Two minutes to set up. Bao does the maths from then on."}
      mascot={<AuthBao attention={attention} />}
      footer={
        mode === "login" ? (
          <>New here? <Link className={btnText} href="/signup">Create an account</Link></>
        ) : (
          <>Already have an account? <Link className={btnText} href="/login">Log in</Link></>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <label className={label}>
          Email
          <input
            className={field} type="email" required autoComplete="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} onFocus={() => setAttention("email")} onBlur={() => setAttention("none")}
          />
        </label>
        <label className={label}>
          <span className="flex items-baseline justify-between">
            Password
            {mode === "login" && <Link className={`text-xs ${btnText}`} href="/forgot-password">Forgot it?</Link>}
          </span>
          <input
            className={field} type="password" required minLength={PASSWORD_MIN_CHARS} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password}
            onChange={(e) => setPassword(e.target.value)} onFocus={() => setAttention("password")} onBlur={() => setAttention("none")}
          />
          {mode === "signup" && <span className="font-normal text-subtle">At least {PASSWORD_MIN_CHARS} characters.</span>}
        </label>
        {error && <p role="alert" className={alert}>{error}</p>}
        {notice && <p role="status" className={noticeBox}>{notice}</p>}
        <button disabled={busy} className={`mt-2 w-full ${btnPrimary}`}>
          {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
