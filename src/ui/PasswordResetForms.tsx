"use client";
// Owner: Platform. Forgot password (SPEC ACC1): ask for the email, Supabase sends a link to
// /auth/callback?next=/reset-password, and the reset page sets the new password for that session.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/platform/db-browser";
import { PASSWORD_MIN_CHARS, passwordProblem } from "./password";

const input = "rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
const button = "mt-2 rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {expired && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">That reset link has expired or was already used. Ask for a new one.</p>}
      {sent ? (
        <p role="status" className="mt-6 text-sm">If an account exists for {email}, Cooky sent it a link to set a new password. Check your email.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input className={input} type="email" required autoComplete="email" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <button disabled={busy} className={button}>{busy ? "Sending…" : "Email me a reset link"}</button>
        </form>
      )}
      <p className="mt-4 text-sm text-zinc-500"><Link className="underline" href="/login">Back to log in</Link></p>
    </main>
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
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="mt-3 text-sm">Open this page from the link in your reset email. That link may have expired.</p>
        <p className="mt-4 text-sm"><Link className="underline" href="/forgot-password">Ask for a new link</Link></p>
      </main>
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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <p className="mt-1 text-sm text-zinc-500">For {email}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          New password <span className="text-zinc-500">(at least {PASSWORD_MIN_CHARS} characters)</span>
          <input className={input} type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_CHARS} value={next} disabled={busy} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          New password again
          <input className={input} type="password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button disabled={busy} className={button}>{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </main>
  );
}
