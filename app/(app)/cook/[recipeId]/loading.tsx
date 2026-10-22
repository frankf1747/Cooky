// Owner: Recipes & Cook. Shown while cook mode loads.
export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-xl p-6" aria-busy="true" aria-label="Loading cook mode">
      <div className="h-7 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
    </section>
  );
}
