// Owner: Plan & Shop. Shown while the shopping list loads.
export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-2xl p-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid gap-2">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />)}
      </div>
    </section>
  );
}
