"use client";
// Owner: Recipes & Cook. Shown when cook mode could not load.
export default function CookError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Cook mode could not load</h1>
      <p role="alert" className="text-sm">The recipe could not be reached. Your fridge has not been changed.</p>
      <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700" onClick={reset}>Try again</button>
    </section>
  );
}
