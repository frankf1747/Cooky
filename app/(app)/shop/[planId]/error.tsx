"use client";
// Owner: Plan & Shop. The shopping list failed to load: say so and offer a retry.
import { useEffect, useState } from "react";
import { btnPrimary } from "@/ui/styles";

export default function ShopError({ error, retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  useEffect(() => console.error(error), [error]);
  return (
    <section className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load your shopping list</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Something went wrong on our side. Your ticks are safe.</p>
      <button
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          retry();
        }}
        className={`mt-4 ${btnPrimary}`}
      >
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </section>
  );
}
