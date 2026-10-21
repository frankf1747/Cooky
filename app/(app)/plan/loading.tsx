// Owner: Plan & Shop. Shown while a plan page loads.
export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-3xl p-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
      <div className="mt-6 h-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
    </section>
  );
}
