"use client";
// Owner: Recipes & Cook. Shown when the library or a recipe could not load.
import { useState } from "react";

export default function RecipesError({ retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">The recipes didn&apos;t load</h1>
      <p role="alert" className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">The recipe library could not be reached. Nothing in your fridge or plans has changed.</p>
      <button disabled={retrying} onClick={() => { setRetrying(true); retry(); }}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </section>
  );
}
