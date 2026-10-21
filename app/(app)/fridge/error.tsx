'use client';
export default function FridgeError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl space-y-4 p-8"><h1 className="text-2xl font-semibold">Your fridge could not load</h1><p role="alert">The catalog or sign-in service could not be reached. Your stored food has not been changed.</p><button className="rounded border px-4 py-2" onClick={reset}>Try again</button></main>;
}
