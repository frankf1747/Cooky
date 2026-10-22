// Owner: Plan & Shop. Shown while preferences load.
export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-3xl p-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />)}
      </div>
    </section>
  );
}
