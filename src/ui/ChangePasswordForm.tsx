"use client";
// Owner: Platform. Change password from Settings (SPEC ACC1). The current password is checked
// first, so an unattended signed-in browser cannot change it.
import { useState } from "react";
import { browserClient } from "@/platform/db-browser";
import { PASSWORD_MIN_CHARS, passwordProblem } from "./password";

const input = "rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    const problem = passwordProblem({ current, next, confirm });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const supabase = browserClient();
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) return setError("Your current password is not right.");
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) return setError(`Cooky couldn't change your password: ${updateError.message}`);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch {
      setError("Cooky couldn't reach the sign-in service. Nothing changed; try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid max-w-sm gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Current password
        <input className={input} type="password" autoComplete="current-password" required value={current} disabled={busy} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        New password <span className="text-zinc-500">(at least {PASSWORD_MIN_CHARS} characters)</span>
        <input className={input} type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_CHARS} value={next} disabled={busy} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        New password again
        <input className={input} type="password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <div className="flex flex-col items-start gap-2">
        <button disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy ? "Changing…" : error ? "Try again" : "Change password"}
        </button>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Password changed. Use the new one next time you log in.</p>}
      </div>
    </form>
  );
}
