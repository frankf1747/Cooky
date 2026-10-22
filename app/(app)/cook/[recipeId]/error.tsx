"use client";
// Owner: Recipes & Cook. Shown when cook mode could not load.
import Link from "next/link";
import { useState } from "react";
import { btnPrimary } from "@/ui/styles";

export default function CookError({ retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <section className="mx-auto w-full max-w-xl p-6">
      <h1 className="text-xl font-semibold">Cook mode could not load</h1>
      <p role="alert" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">The recipe could not be reached. Your fridge has not been changed.</p>
      <div className="mt-4 flex gap-3">
        <button disabled={retrying} onClick={() => { setRetrying(true); retry(); }}
          className={btnPrimary}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
        <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700" href="/recipes">Back to recipes</Link>
      </div>
    </section>
  );
}
