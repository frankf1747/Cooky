"use client";
// Owner: Platform. The billing page could not load: say so and offer a retry (never made-up defaults).
import { useState } from "react";
import { btnPrimary } from "@/ui/styles";

export default function BillingError({ retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load Cooky Pro</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Something went wrong on our side. Nothing was changed.</p>
      <button disabled={retrying} onClick={() => { setRetrying(true); retry(); }}
        className={`mt-4 ${btnPrimary}`}>
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </section>
  );
}
