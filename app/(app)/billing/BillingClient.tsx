"use client";
// Owner: Platform. Unlock Pro (ACC5) and the "confirming payment" return page (ACC7). The return
// URL never unlocks anything: only the webhook grants Pro, and this page polls until it has.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Entitlement } from "@spec/contract";
import { formatUsd } from "@/platform/money";
import { billingErrorMessage, waitForPro, type BillingError } from "./ui";

type Props = {
  initial: Entitlement;
  status: "success" | "cancelled" | null;
  priceCents: number;
  poll: { intervalMs: number; maxMs: number };
};

export function BillingClient({ initial, status, priceCents, poll }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BillingError | null>(null);
  const [waiting, setWaiting] = useState(status === "success" && initial.plan !== "pro");
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    void waitForPro({
      check: () => fetch("/api/billing/entitlement").then((r) => (r.ok ? (r.json() as Promise<Entitlement>) : null)).catch(() => null),
      sleep: (ms) => new Promise((ok) => setTimeout(ok, ms)),
      now: () => Date.now(),
      cancelled: () => cancelled,
      intervalMs: poll.intervalMs,
      maxMs: poll.maxMs,
    }).then((result) => {
      if (result === "cancelled") return;
      setWaiting(false);
      if (result === "timeout") return setGaveUp(true);
      setPlan(result);
      router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [waiting, poll.intervalMs, poll.maxMs, router]);

  async function unlock() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(billingErrorMessage(res.status, body));
      window.location.assign(body.url);
    } catch {
      setError(billingErrorMessage(0, {}));
    } finally {
      setBusy(false);
    }
  }

  if (plan.plan === "pro") {
    return (
      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
        <p className="font-medium text-emerald-900 dark:text-emerald-100">Cooky Pro is on.</p>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">AI plans and swaps, receipt scanning and the cooking assistant are unlocked, each within its daily limit.</p>
      </div>
    );
  }

  if (waiting) {
    return (
      <p className="mt-6 text-zinc-700 dark:text-zinc-300" role="status" aria-live="polite">
        Confirming your payment with Stripe… This usually takes a few seconds.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      {gaveUp && (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Stripe hasn&apos;t confirmed the payment yet. If you paid, it will appear shortly.{" "}
          <button className="font-medium underline" onClick={() => { setGaveUp(false); setWaiting(true); }}>Check again</button>
        </div>
      )}
      {status === "cancelled" && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">Payment cancelled. Nothing was charged and you&apos;re still on Free.</p>
      )}
      <ul className="grid gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        <li>Free: the recipe library, your fridge, cook-mode steps, Cook now, and one AI plan.</li>
        <li>Pro: AI plans and swaps, receipt scanning and the cooking assistant, each within a daily limit.</li>
      </ul>
      <div className="flex flex-col items-start gap-2">
        <button onClick={unlock} disabled={busy} className="rounded-md bg-zinc-900 px-5 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy ? "Opening Stripe…" : error?.retry ? "Try again" : `Unlock Pro · ${formatUsd(priceCents)} once`}
        </button>
        <p className="text-xs text-zinc-500">Stripe test mode: use card 4242 4242 4242 4242. No real money is charged.</p>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error.message}</p>}
      </div>
    </div>
  );
}
