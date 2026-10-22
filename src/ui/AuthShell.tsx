// Owner: Platform. The frame for the signed-out pages (log in, sign up, reset a password): a
// brand panel with Bao centre stage and the promise, and the form. Side by side on wide screens,
// stacked on phones, where Bao sits between the wordmark and the promise, above the form.
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarCheck, CookingPot, Receipt } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { tiles, type Tile } from "./styles";

const LOOP: { icon: Icon; tile: Tile; text: string }[] = [
  { icon: CalendarCheck, tile: "butter", text: "Plan dinners from what is already in your fridge." },
  { icon: Receipt, tile: "tangerine", text: "Shop one list in real package sizes, then scan the receipt." },
  { icon: CookingPot, tile: "mint", text: "Cook before anything goes off, one step at a time." },
];

export function AuthShell({ title, lead, mascot, children, footer }: { title: string; lead?: ReactNode; mascot?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative overflow-hidden bg-tile-sky px-4 pb-8 pt-6 sm:px-6 lg:flex lg:flex-col lg:px-14 lg:py-10">
        {/* dotted paper, a quiet nod to the v1 recipe pages */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:radial-gradient(var(--accent)_1.2px,transparent_1.2px)] [background-size:22px_22px]" />

        <div className="relative flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">Cooky</Link>
          <span className="rounded-full bg-surface/80 px-3 py-1 text-xs font-medium">Free to start</span>
        </div>

        <div className="relative my-6 flex justify-center lg:my-0 lg:flex-1 lg:items-center">{mascot}</div>

        <div className="relative">
          <p className="mx-auto max-w-md text-center font-display text-[28px] font-semibold leading-[1.05] tracking-tight sm:text-3xl lg:mx-0 lg:text-left lg:text-[2.6rem]">
            Cook what you have. Buy only what you need.
          </p>
          <ul className="mt-7 hidden max-w-md space-y-3 lg:block">
            {LOOP.map(({ icon: Icon, tile, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] leading-snug">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tiles[tile]}`}>
                  <Icon size={20} weight="duotone" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <p className="mt-6 hidden text-sm text-zinc-600 lg:block dark:text-zinc-400">Payments run in Stripe test mode, so nothing is charged.</p>
        </div>
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
