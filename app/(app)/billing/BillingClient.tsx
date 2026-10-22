"use client";
// Owner: Platform. Unlock Pro (ACC5) and the "confirming payment" return page (ACC7). The return
// URL never unlocks anything: only the webhook grants Pro, and this page polls until it has.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";
import type { Entitlement } from "@spec/contract";
import { formatUsd } from "@/platform/money";
import { BaoSays } from "@/ui/Bao";
import { alert, btnPrimary, btnSecondary, btnText, note, panel, tagPro } from "@/ui/styles";

const FREE = ["The recipe library", "Your virtual fridge and Cook now", "Cook-mode steps, timers and tips", "One AI plan"];
const PRO = ["AI plans and meal swaps", "Receipt scanning into the fridge", "Bao answers cooking questions", "Each within a daily limit"];

function Features({ items, on }: { items: string[]; on: boolean }) {
  return (
    <ul className="mt-5 grid gap-3 text-[15px]">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2.5">
          <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-basil text-surface" : "bg-sunken text-muted"}`}>
            <Check size={12} weight="bold" />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}
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
      <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <BaoSays mood="celebrating" pose="cheer" motion="hop" size={104}>Cooky Pro is on. Plans, receipts and the kitchen, all of it.</BaoSays>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/plan" className={btnPrimary}>Plan dinners</Link>
            <Link href="/receipts/new" className={btnSecondary}>Stock the fridge</Link>
          </div>
        </div>
        <div className={`p-6 ${panel}`}>
          <p className={tagPro}>Cooky Pro</p>
          <Features items={PRO} on />
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div role="status" aria-live="polite">
        <BaoSays mood="thinking" pose="think" motion="breathe" size={88}>Confirming your payment with Stripe. This usually takes a few seconds.</BaoSays>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {gaveUp && (
        <div role="status" className={note}>
          Stripe hasn&apos;t confirmed the payment yet. If you paid, it will appear shortly.{" "}
          <button className={btnText} onClick={() => { setGaveUp(false); setWaiting(true); }}>Check again</button>
        </div>
      )}
      {status === "cancelled" && (
        <p role="status" className={note}>Payment cancelled. Nothing was charged and you&apos;re still on Free.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="free-title" className={`p-6 sm:p-7 ${panel}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="free-title" className="font-display text-xl font-semibold">Free</h2>
            <p className="font-display text-3xl font-semibold text-muted">{formatUsd(0)}</p>
          </div>
          <p className="mt-1 text-[15px] text-muted">What you have now.</p>
          <Features items={FREE} on={false} />
        </section>
        <section aria-labelledby="pro-title" className="rounded-2xl border-2 border-foreground bg-surface p-6 sm:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="pro-title" className="font-display text-xl font-semibold">Pro</h2>
            <p><span className="font-display text-3xl font-semibold">{formatUsd(priceCents)}</span> <span className="text-sm text-muted">once</span></p>
          </div>
          <p className="mt-1 text-[15px] text-muted">Everything in Free, and Bao in every step.</p>
          <Features items={PRO} on />
          <button onClick={unlock} disabled={busy} className={`mt-7 w-full ${btnPrimary}`}>
            {busy ? "Opening Stripe…" : error?.retry ? "Try again" : `Unlock Pro, ${formatUsd(priceCents)} once`}
          </button>
          <p className="mt-3 text-sm text-muted">Stripe test mode: use card 4242 4242 4242 4242. No real money is charged.</p>
          {error && <p role="alert" className={`mt-3 ${alert}`}>{error.message}</p>}
        </section>
      </div>
    </div>
  );
}
