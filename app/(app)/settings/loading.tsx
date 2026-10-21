// Owner: Platform. Shown while the profile form loads.
export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-3xl p-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />)}
      </div>
      <div className="mt-6 h-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
    </section>
  );
}
