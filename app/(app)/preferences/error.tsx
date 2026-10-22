"use client";
// Owner: Plan & Shop. Preferences failed to load: say so and offer a retry.
import { useEffect, useState } from "react";

export default function PreferencesError({ error, retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  useEffect(() => console.error(error), [error]);
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load your preferences</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Something went wrong on our side. Nothing was changed.</p>
      <button
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          retry();
        }}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </section>
  );
}
