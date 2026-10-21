"use client";
// Owner: Receipts. Re-read a failed receipt from its stored photo (RCT7).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { receiptErrorMessage, type ApiErrorBody, type ReceiptError } from "../ui";

export function RetryButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReceiptError | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/retry`, { method: "POST" });
      if (!res.ok) return setError(receiptErrorMessage(res.status, (await res.json().catch(() => ({}))) as ApiErrorBody));
      router.refresh();
    } catch {
      setError(receiptErrorMessage(0, {}));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button onClick={retry} disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {busy ? "Reading again…" : "Try reading it again"}
      </button>
      {error && <p role="alert" className="text-sm text-red-800 dark:text-red-200">{error.message}</p>}
    </div>
  );
}
