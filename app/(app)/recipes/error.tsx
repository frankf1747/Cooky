"use client";
// Owner: Recipes & Cook. Shown when the library or a recipe could not load.
export default function RecipesError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Recipes could not load</h1>
      <p role="alert" className="text-sm">The recipe library could not be reached. Nothing in your fridge or plans has changed.</p>
      <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700" onClick={reset}>Try again</button>
    </section>
  );
}
