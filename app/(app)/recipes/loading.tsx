// Owner: Recipes & Cook. Shown while the library or a recipe loads.
export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-5xl p-6" aria-busy="true" aria-label="Loading recipes">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />)}
      </div>
    </section>
  );
}
