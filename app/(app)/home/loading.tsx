// Owner: Platform. Shown while Home loads.
export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />)}</div>
        <div className="h-48 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </section>
  );
}
