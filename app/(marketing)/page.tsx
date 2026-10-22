// Owner: Platform. The front door for signed-out visitors, in the app's own look: the promise and
// the fridge you can play with, the week as the app's four tabs, what Bao does and doesn't do,
// the food, and one way in. Bao appears once, on the fridge; the rest is paper, ink and food.
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { ArrowRight, Basket, CalendarCheck, CookingPot, Package, Receipt, Snowflake, Timer, TrayArrowDown } from "@phosphor-icons/react/ssr";
import { getSessionUser } from "@/platform/auth";
import { Wordmark } from "@/ui/AppNav";
import { DishArt } from "@/ui/DishArt";
import { Kicker } from "@/ui/Page";
import { btnPrimary, btnSecondary, chipRow, h2, tones, type Tone } from "@/ui/styles";
import { FridgeDemo } from "./FridgeDemo";

/** The week, in the order and words of the app's own tabs. */
const WEEK: { tone: Tone; icon: Icon; tab: string; title: string; text: string }[] = [
  { tone: "plan", icon: CalendarCheck, tab: "Plan", title: "Pick from the fridge", text: "Tap the dishes you can cook now. Bao fills the rest of the week around your budget and time, or picks them all." },
  { tone: "shop", icon: Basket, tab: "Shop", title: "Buy exactly enough", text: "One list in real package sizes, with prices, minus what you already have." },
  { tone: "scan", icon: TrayArrowDown, tab: "Stock", title: "Snap the receipt", text: "One photo logs what you paid and puts the food away. You check every line before it goes in." },
  { tone: "cook", icon: CookingPot, tab: "Cook", title: "Cook it in order", text: "One button walks you through every dish in the plan, a step at a time. On Pro, Bao answers questions as you go." },
];

/** What Bao promises: the sums are done in code, and dates are never dressed up as safety. */
const PROMISES: { icon: Icon; title: string; text: string }[] = [
  { icon: Package, title: "Real package sizes", text: "Recipes become the packs a shop sells, so a list never says 37 g of spinach." },
  { icon: Receipt, title: "Prices you actually paid", text: "From your receipts, to the cent. When a price is unknown, it says so." },
  { icon: Timer, title: "Use-soon, not guesswork", text: "Each food gets a typical shelf life with its source, so the right dish comes first." },
];

/** A few dishes from the library, drawn; times and counts live in the library, not here. */
const DISHES = [
  ["rcp_shakshuka", "Shakshuka eggs in tomato sauce"],
  ["rcp_garlic_butter_pasta", "Garlic butter spaghetti with peas"],
  ["rcp_oyakodon", "Oyakodon chicken and egg rice bowl"],
  ["rcp_chickpea_coconut_curry", "Chickpea coconut curry with kale"],
  ["rcp_honey_garlic_salmon", "Honey garlic salmon with green beans"],
  ["rcp_beef_tacos", "Smoky beef tacos"],
] as const;

export default async function Home() {
  if (await getSessionUser()) redirect("/home");
  return (
    <main id="main" className="flex-1 overflow-x-clip">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Cooky, home" className="rounded-full"><Wordmark /></Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-[15px] font-medium text-foreground underline-offset-4 hover:underline">Log in</Link>
            <Link href="/signup" className={`${btnPrimary} !h-10 !px-4 !text-sm`}>Get started</Link>
          </nav>
        </div>
      </header>

      {/* hero: the promise, and the fridge you can tap */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12 md:pb-24 md:pt-14 lg:px-8">
        <div className="rise-in">
          <Kicker tone="plan">Dinner planning, from your fridge</Kicker>
          <h1 className="mt-5 font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[4.25rem]">
            Cook what you <em className="font-medium italic text-accent">have.</em> Buy only what you <em className="font-medium italic text-accent">need.</em>
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
            Cooky keeps a virtual fridge from your receipts, plans the week&apos;s dishes around it, and writes one shopping list in real package sizes. Less waste, fewer extra trips.
          </p>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/signup" className={btnPrimary}>
              Create a free account
              <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
            <Link href="/login" className={btnSecondary}>Log in</Link>
          </div>
          <p className="mt-4 text-sm text-subtle">Free to start. Two minutes to set up.</p>
        </div>
        <div className="relative">
          {/* a soft cobalt dough behind the fridge, so it sits on something */}
          <div aria-hidden className="shape-dough absolute left-1/2 top-[55%] h-[85%] w-[110%] -translate-x-1/2 -translate-y-1/2 bg-cobalt-tint/70" />
          <div className="relative">
            <FridgeDemo />
          </div>
        </div>
      </section>

      {/* the week, as the app's tabs */}
      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Kicker>How a week goes</Kicker>
          <h2 className={`${h2} mt-3 max-w-xl sm:!text-4xl`}>Four tabs, a week of dishes</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WEEK.map((w, i) => (
              <li key={w.tab} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span aria-hidden className={`shape-dough flex h-12 w-12 items-center justify-center ${tones[w.tone].tint} ${tones[w.tone].ink}`}>
                    <w.icon size={24} weight="duotone" />
                  </span>
                  <span className="text-[13px] font-medium text-subtle tabular-nums">{i + 1} · {w.tab}</span>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold leading-snug">{w.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{w.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* what Bao does the sums for */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
          <div>
            <Kicker>Bao does the maths</Kicker>
            <h2 className={`${h2} mt-3 sm:!text-4xl`}>Numbers you can trust, worked out in code</h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted">
              The AI suggests and explains. Quantities, prices and dates are always calculated, and you confirm before anything changes your fridge.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {PROMISES.map((p) => (
              <li key={p.title} className="flex gap-4 p-5">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cobalt-tint text-cobalt-ink">
                  <p.icon size={20} weight="bold" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* the food */}
      <section className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Kicker tone="cook">The library</Kicker>
          <h2 className={`${h2} mt-3 max-w-md sm:!text-4xl`}>Dishes written for weeknights</h2>
        </div>
        <ul className={`mx-auto mt-8 max-w-6xl lg:grid lg:grid-cols-6 lg:gap-6 lg:px-8 ${chipRow} !gap-4 sm:!px-6`}>
          {DISHES.map(([id, title]) => (
            <li key={id} className="w-36 shrink-0 lg:w-auto">
              <DishArt id={id} title={title} frame="plate" className="aspect-square w-full rounded-full" />
              <p className="mt-3 text-center text-[15px] font-medium leading-snug">{title}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* one way in */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-cobalt-deep px-6 py-12 text-on-brand sm:px-14 sm:py-16">
          <div aria-hidden className="shape-dough absolute -right-16 -top-10 h-72 w-80 bg-on-brand/[0.07]" />
          <Snowflake aria-hidden size={200} weight="thin" className="absolute -bottom-12 right-6 hidden text-on-brand/10 md:block" />
          <div className="relative max-w-xl">
            <h2 className="font-display text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">Your fridge is waiting.</h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-on-brand/80">Tell Bao who you cook for, snap your next receipt, and the shelves fill themselves.</p>
            <Link href="/signup" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 text-[15px] font-medium text-on-paper transition hover:brightness-95 active:scale-[0.97]">
              Create a free account
              <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
        <p>Payments run in Stripe test mode, so nothing is charged.</p>
        <nav className="flex gap-5">
          <Link href="/brand" className="hover:text-foreground hover:underline">Brand</Link>
          <Link href="/login" className="hover:text-foreground hover:underline">Log in</Link>
        </nav>
      </footer>
    </main>
  );
}
