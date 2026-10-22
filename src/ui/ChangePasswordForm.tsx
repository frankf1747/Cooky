"use client";
// Owner: Platform. Change password from Settings (SPEC ACC1). The current password is checked
// first, so an unattended signed-in browser cannot change it.
import { useState } from "react";
import { browserClient } from "@/platform/db-browser";
import { PASSWORD_MIN_CHARS, passwordProblem } from "./password";
import { alert, btnPrimary, field as input, label, notice } from "./styles";


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
    <form onSubmit={submit} className="grid max-w-sm gap-5">
      <label className={label}>
        Current password
        <input className={input} type="password" autoComplete="current-password" required value={current} disabled={busy} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className={label}>
        <span>New password <span className="font-normal text-subtle">(at least {PASSWORD_MIN_CHARS} characters)</span></span>
        <input className={input} type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_CHARS} value={next} disabled={busy} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className={label}>
        New password again
        <input className={input} type="password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <div className="flex flex-col items-stretch gap-2 sm:items-start">
        <button disabled={busy} className={btnPrimary}>
          {busy ? "Changing…" : error ? "Try again" : "Change password"}
        </button>
        {error && <p role="alert" className={alert}>{error}</p>}
        {done && <p role="status" className={notice}>Password changed. Use the new one next time you log in.</p>}
      </div>
    </form>
  );
}
