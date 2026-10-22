"use client";
// Owner: Platform. Forgot password (SPEC ACC1): ask for the email, Supabase sends a link to
// /auth/callback?next=/reset-password, and the reset page sets the new password for that session.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/platform/db-browser";
import { AuthShell } from "./AuthShell";
import { PASSWORD_MIN_CHARS, passwordProblem } from "./password";
import { alert, btnPrimary, btnText, field as input } from "./styles";

const button = `mt-2 ${btnPrimary}`;

export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: sendError } = await browserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      // Rate limits and outages are real errors; an unknown email is not revealed either way.
      if (sendError && sendError.status !== 400) return setError(`Cooky couldn't send the email: ${sendError.message}`);
      setSent(true);
    } catch {
      setError("Cooky couldn't reach the sign-in service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      lead="Enter your email and Cooky sends a link to set a new one."
      footer={<Link className={btnText} href="/login">Back to log in</Link>}
    >
      {expired && <p role="alert" className={`mb-4 ${alert}`}>That reset link has expired or was already used. Ask for a new one.</p>}
      {sent ? (
        <p role="status" className="rounded-lg bg-accent-soft p-3 text-sm">If an account exists for {email}, Cooky sent it a link to set a new password. Check your email.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <input className={input} type="email" required autoComplete="email" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p role="alert" className={alert}>{error}</p>}
          <button disabled={busy} className={button}>{busy ? "Sending…" : "Email me a reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordForm({ email }: { email: string | null }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email) {
    return (
      <AuthShell title="Set a new password" lead="Open this page from the link in your reset email. That link may have expired.">
        <Link className={btnText} href="/forgot-password">Ask for a new link</Link>
      </AuthShell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = passwordProblem({ next, confirm });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await browserClient().auth.updateUser({ password: next });
      if (updateError) return setError(`Cooky couldn't set your password: ${updateError.message}`);
      router.push("/home");
      router.refresh();
    } catch {
      setError("Cooky couldn't reach the sign-in service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Set a new password" lead={`For ${email}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          New password <span className="font-normal text-zinc-500">(at least {PASSWORD_MIN_CHARS} characters)</span>
          <input className={input} type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_CHARS} value={next} disabled={busy} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          New password again
          <input className={input} type="password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p role="alert" className={alert}>{error}</p>}
        <button disabled={busy} className={button}>{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </AuthShell>
  );
}
