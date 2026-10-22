import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { btnPrimary, btnSecondary } from "@/ui/styles";

const STEPS = [
  ["Plan from your fridge", "Pick how many dinners, your budget and time. Cooky builds the week around what you already have."],
  ["Buy exactly enough", "One shopping list in real package sizes, with the price, so nothing extra goes to waste."],
  ["Scan the receipt", "A photo of the receipt stocks your fridge. You check every line first."],
  ["Cook before it goes off", "Cooky shows what to use soon and guides you through the recipe, one step at a time."],
];

export default async function Home() {
  if (await getSessionUser()) redirect("/home");
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-lg font-semibold tracking-tight">Cooky</p>
      <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Cook what you have. Buy only what you need.</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        A weekly dinner planner with a virtual fridge, so food gets eaten instead of thrown away.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className={btnPrimary}>Create a free account</Link>
        <Link href="/login" className={btnSecondary}>Log in</Link>
      </div>
      <ol className="mt-16 grid gap-6 sm:grid-cols-2">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-16 text-sm text-zinc-500">Payments run in Stripe test mode, so nothing is charged.</p>
    </main>
  );
}
