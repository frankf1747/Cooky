"use client";
// Owner: Plan & Shop. Swap one meal (PLN7) and answer the preference proposals its reason produced
// (LRN2). Keyed by meal position on the page, so the proposals stay visible after the refresh.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PreferenceProposal } from "@spec/contract";
import { formatUsd } from "@/platform/money";
import { planErrorMessage, type ApiErrorBody } from "../ui";

const btnGhost = "rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700";
const input = "rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type Answer = "always" | "once" | "dismiss";

export function SwapMeal({ planId, version, mealIndex, title, maxChars }: { planId: string; version: number; mealIndex: number; title: string; maxChars: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof planErrorMessage> | null>(null);
  const [proposals, setProposals] = useState<PreferenceProposal[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer | "saving" | "error">>({});

  async function swap(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/swap`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mealIndex, baseVersion: version, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(planErrorMessage(res.status, body as ApiErrorBody, formatUsd));
      setProposals((body as { proposals?: PreferenceProposal[] }).proposals ?? []);
      setAnswers({});
      setOpen(false);
      setReason("");
      router.refresh();
    } catch {
      setError({ message: "Couldn't reach Cooky. Check your connection and try again.", retry: true });
    } finally {
      setBusy(false);
    }
  }

  async function answer(p: PreferenceProposal, scope: Answer) {
    setAnswers((a) => ({ ...a, [p.id]: "saving" }));
    try {
      const res = await fetch("/api/preferences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposalId: p.id, scope }) });
      setAnswers((a) => ({ ...a, [p.id]: res.ok ? scope : "error" }));
    } catch {
      setAnswers((a) => ({ ...a, [p.id]: "error" }));
    }
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button className={btnGhost} onClick={() => { setOpen(true); setError(null); }} disabled={busy}>
          Swap this dish
        </button>
      ) : (
        <form onSubmit={swap} className="flex flex-wrap items-center gap-2" aria-busy={busy}>
          <input
            className={`${input} min-w-0 flex-1`}
            value={reason}
            maxLength={maxChars}
            disabled={busy}
            autoFocus
            placeholder={`Why swap ${title}? (optional, e.g. too heavy for a weeknight)`}
            aria-label="Why swap this dish (optional)"
            onChange={(e) => setReason(e.target.value)}
          />
          <button className={btnGhost} disabled={busy}>{busy ? "Finding another dish…" : "Swap"}</button>
          <button type="button" className={btnGhost} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
        </form>
      )}

      {error && (
        <div role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          <p>{error.message}</p>
          <div className="mt-1 flex gap-3">
            {error.retry && <button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={() => swap()}>Try again</button>}
            {error.upgrade && <Link className="underline" href="/billing">Unlock Pro</Link>}
          </div>
        </div>
      )}

      {proposals.map((p) => {
        const a = answers[p.id];
        return (
          <div key={p.id} className="mt-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Remember this for next time?</p>
            <p className="mt-1 font-medium">{p.value}</p>
            <p className="text-xs text-zinc-500">{p.reason}</p>
            {a === "always" || a === "once" || a === "dismiss" ? (
              <p className="mt-2">{a === "always" ? "Saved. Your next plans will use it." : a === "once" ? "Used for your next plan only." : "Not saved."}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={btnGhost} disabled={a === "saving"} onClick={() => answer(p, "always")}>Always</button>
                <button className={btnGhost} disabled={a === "saving"} onClick={() => answer(p, "once")}>Just this time</button>
                <button className={btnGhost} disabled={a === "saving"} onClick={() => answer(p, "dismiss")}>Don&apos;t save</button>
              </div>
            )}
            {a === "error" && <p className="mt-2 text-red-700 dark:text-red-300">That didn&apos;t save. You can add it on the <Link className="underline" href="/preferences">Preferences</Link> page.</p>}
          </div>
        );
      })}
    </div>
  );
}
