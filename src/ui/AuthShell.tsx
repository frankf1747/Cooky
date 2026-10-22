// Owner: Platform. The frame for the signed-out pages (log in, sign up, reset a password): a
// brand panel with Bao and the promise, and the form. Side by side on wide screens, stacked on
// phones, where the panel shrinks to the wordmark, a small Bao and the promise so the form stays
// in reach.
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarCheck, CookingPot, Receipt } from "@phosphor-icons/react/ssr";

const LOOP = [
  { icon: CalendarCheck, text: "Plan dinners from what is already in your fridge." },
  { icon: Receipt, text: "Shop one list in real package sizes, then scan the receipt." },
  { icon: CookingPot, text: "Cook before anything goes off, one step at a time." },
];

export function AuthShell({ title, lead, mascot, children, footer }: { title: string; lead?: ReactNode; mascot?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="bg-tile-sky px-4 pb-7 pt-8 sm:px-6 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="flex items-start justify-between gap-4">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">Cooky</Link>
          <div className="lg:hidden">{mascot}</div>
        </div>
        <div className="mt-4 lg:mt-0">
          <div className="hidden lg:block">{mascot}</div>
          <p className="mt-6 max-w-md font-display text-[28px] font-semibold leading-[1.05] tracking-tight sm:text-3xl lg:text-5xl">
            Cook what you have. Buy only what you need.
          </p>
          <ul className="mt-8 hidden max-w-md space-y-4 lg:block">
            {LOOP.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-[15px] leading-snug">
                <Icon size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-sm text-zinc-600 lg:block dark:text-zinc-400">Free to start. Payments run in Stripe test mode, so nothing is charged.</p>
      </aside>

      <section className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:justify-center lg:px-14">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-[26px] font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {lead && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{lead}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
