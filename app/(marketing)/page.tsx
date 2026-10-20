import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-semibold tracking-tight">Cooky</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Plan meals from what is already in your fridge, buy exactly what the recipes need, snap the receipt to stock
        your virtual fridge, and cook the right dish before food goes off.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Get started
        </Link>
        <Link href="/login" className="rounded-md border border-zinc-300 px-4 py-2 dark:border-zinc-700">
          Log in
        </Link>
      </div>
      <p className="text-sm text-zinc-500">Payments run in Stripe test mode: no real charges.</p>
    </main>
  );
}
