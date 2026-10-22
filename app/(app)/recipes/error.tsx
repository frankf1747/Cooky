"use client";
// Owner: Recipes & Cook. Shown when the library or a recipe could not load.
import { useState } from "react";
import { btnPrimary } from "@/ui/styles";

export default function RecipesError({ retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">The recipes didn&apos;t load</h1>
      <p role="alert" className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">The recipe library could not be reached. Nothing in your fridge or plans has changed.</p>
      <button disabled={retrying} onClick={() => { setRetrying(true); retry(); }}
        className={`mt-4 ${btnPrimary}`}>
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </section>
  );
}
