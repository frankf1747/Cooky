// Owner: Platform. The frame for the signed-out pages (log in, sign up, reset a password): a
// brand panel that is only Bao and one line, and the form. Side by side on wide screens, stacked
// on phones.
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, lead, mascot, children, footer }: { title: string; lead?: ReactNode; mascot?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="flex flex-col bg-tile-sky px-6 pb-9 pt-6 lg:px-16 lg:py-10">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">Cooky</Link>
        <div className="my-8 flex justify-center lg:my-0 lg:flex-1 lg:items-center">{mascot}</div>
        <p className="mx-auto max-w-xs text-center font-display text-2xl font-semibold leading-tight tracking-tight lg:max-w-sm lg:text-[2rem]">
          Cook what you have. Buy only what you need.
        </p>
      </aside>

      <section className="flex flex-1 flex-col px-6 py-10 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-[26px] font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {lead && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{lead}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">{footer}</div>}
          <p className="mt-10 text-xs text-zinc-500">Payments run in Stripe test mode, so nothing is charged.</p>
        </div>
      </section>
    </main>
  );
}
