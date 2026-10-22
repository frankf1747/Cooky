// Owner: Platform. The front door for signed-out visitors: what Cooky does in one sentence, the
// food and the bun, how a week goes, and one way in.
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { Basket, CalendarCheck, CookingPot, TrayArrowDown } from "@phosphor-icons/react/ssr";
import { getSessionUser } from "@/platform/auth";
import { Wordmark } from "@/ui/AppNav";
import { Bao } from "@/ui/Bao";
import { DishArt } from "@/ui/DishArt";
import { Kicker } from "@/ui/Page";
import { btnPrimary, btnSecondary, btnText, h2, tones, type Tone } from "@/ui/styles";

const STEPS: { tone: Tone; icon: Icon; title: string; text: string }[] = [
  { tone: "plan", icon: CalendarCheck, title: "Plan from your fridge", text: "Open the fridge, tap the dishes you can cook today, and Bao plans the rest of the week around your budget and time." },
  { tone: "shop", icon: Basket, title: "Buy exactly enough", text: "One shopping list in real package sizes, with prices, so nothing extra goes to waste." },
  { tone: "scan", icon: TrayArrowDown, title: "Stock the fridge", text: "A photo of the receipt logs the prices and puts the food away. You check every line first." },
  { tone: "cook", icon: CookingPot, title: "Cook it in order", text: "One Cook button walks you through every dinner in the plan, one step at a time." },
];

// A few dishes from the library, drawn; times and counts live in the library, not here.
const DISHES = [
  ["rcp_shakshuka", "Shakshuka eggs in tomato sauce"],
  ["rcp_garlic_butter_pasta", "Garlic butter spaghetti with peas"],
  ["rcp_oyakodon", "Oyakodon chicken and egg rice bowl"],
  ["rcp_chickpea_coconut_curry", "Chickpea coconut curry with kale"],
] as const;

export default async function Home() {
  if (await getSessionUser()) redirect("/home");
  return (
    <main id="main" className="flex-1">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Cooky, home" className="rounded-full"><Wordmark /></Link>
        <nav className="flex items-center gap-5">
          <Link href="/login" className="text-[15px] font-medium text-foreground hover:underline">Log in</Link>
          <Link href="/signup" className={`${btnPrimary} !h-10 !px-4 !text-sm`}>Get started</Link>
        </nav>
      </header>

      {/* hero: the promise on the left, the food and the bun on the right */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:pb-24 md:pt-16 lg:px-8">
        <div className="rise-in">
          <Kicker tone="shop">A dinner planner with a virtual fridge</Kicker>
          <h1 className="mt-5 font-display text-[3rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[4.5rem]">
            Cook what you <em className="font-medium italic">have.</em> Buy only what you <em className="font-medium italic">need.</em>
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
            Cooky plans the week&apos;s dinners around your fridge, writes one shopping list in real package sizes, and gets food eaten instead of thrown away.
          </p>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/signup" className={btnPrimary}>Create a free account</Link>
            <Link href="/login" className={btnSecondary}>Log in</Link>
          </div>
        </div>
        <div className="relative">
          <DishArt id="rcp_shakshuka" title="Shakshuka eggs in tomato sauce" className="shape-dome aspect-[4/3] w-full" />
          <div className="absolute -bottom-6 -left-2 flex items-end gap-1 sm:-left-8">
            <Bao mood="welcoming" pose="wave" motion="breathe" size={150} className="h-28 w-28 sm:h-36 sm:w-36" />
            <p className="mb-12 rounded-[18px] rounded-bl-md bg-surface px-4 py-2.5 text-[15px] font-medium shadow-float">Hi. I&apos;m Bao. I do the maths.</p>
          </div>
        </div>
      </section>

      {/* how a week goes */}
      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <h2 className={`${h2} sm:!text-4xl`}>How a week goes</h2>
          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span aria-hidden className={`shape-dough flex h-16 w-16 items-center justify-center ${tones[s.tone].tint} ${tones[s.tone].ink}`}>
                  <s.icon size={28} weight="duotone" />
                </span>
                <p className="mt-5 text-[13px] font-medium text-muted">Step {i + 1}</p>
                <h3 className="mt-1 font-display text-xl font-semibold leading-snug">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* the food */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className={`${h2} max-w-md sm:!text-4xl`}>Dinners written for weeknights</h2>
          <Link href="/signup" className={btnText}>See them all</Link>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {DISHES.map(([id, title]) => (
            <li key={id}>
              <DishArt id={id} title={title} className="shape-dome aspect-[4/3] w-full" />
              <p className="mt-3 font-display text-lg font-semibold leading-snug">{title}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* one way in */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-cobalt-deep px-6 py-12 text-on-brand sm:px-14 sm:py-16">
          <div aria-hidden className="shape-dough absolute -right-16 -top-10 h-72 w-80 bg-on-brand/[0.07]" />
          <div className="relative grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">Your fridge is waiting.</h2>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-on-brand/80">Two minutes to set up. Bao does the maths from then on.</p>
              <Link href="/signup" className="mt-8 inline-flex h-12 items-center rounded-full bg-surface px-6 text-[15px] font-medium text-foreground transition hover:bg-background active:scale-[0.97]">
                Create a free account
              </Link>
            </div>
            <Bao mood="celebrating" pose="hold" prop="spoon" size={180} className="hidden md:block" />
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
