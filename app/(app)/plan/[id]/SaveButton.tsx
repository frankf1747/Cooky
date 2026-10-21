"use client";
// Owner: Plan & Shop. Save a draft version (PLN6): saved versions are immutable.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUsd } from "@/platform/money";
import { planErrorMessage, type ApiErrorBody } from "../ui";

export function SaveButton({ planId, version }: { planId: string; version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) return setError(planErrorMessage(res.status, (await res.json().catch(() => ({}))) as ApiErrorBody, formatUsd));
      router.refresh();
    } catch {
      setError({ message: "Couldn't reach Cooky. Check your connection and try again.", retry: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button onClick={save} disabled={busy} className="rounded-md bg-zinc-900 px-5 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {busy ? "Saving…" : error?.retry ? "Try saving again" : "Save this plan"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error.message}</p>}
    </div>
  );
}
