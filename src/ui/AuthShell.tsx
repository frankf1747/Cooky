// Owner: Platform. The frame for the signed-out pages (log in, sign up, reset a password): a
// deep cobalt brand panel that holds Bao and one line, and the form on paper. Side by side on
// wide screens; on phones the panel is a short band above the form.
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./AppNav";
import { h1 } from "./styles";

export function AuthShell({ title, lead, mascot, children, footer }: { title: string; lead?: ReactNode; mascot?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="flex flex-1 flex-col lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative flex flex-col overflow-hidden bg-cobalt-deep px-6 pb-8 pt-5 text-on-brand lg:px-14 lg:py-10">
        <Link href="/" aria-label="Cooky, home" className="w-fit rounded-full">
          <Wordmark />
        </Link>
        {/* a soft dough shape behind Bao, the only decoration on the panel */}
        <div aria-hidden className="shape-dough absolute left-1/2 top-[52%] h-64 w-72 -translate-x-1/2 -translate-y-1/2 bg-on-brand/[0.07] lg:h-[26rem] lg:w-[30rem]" />
        <div className="relative my-6 flex justify-center lg:my-0 lg:flex-1 lg:items-center">{mascot}</div>
        <p className="relative mx-auto hidden max-w-md text-center font-display text-[2.25rem] font-medium leading-[1.08] tracking-[-0.02em] lg:block">
          Cook what you <em className="italic">have</em>. Buy only what you <em className="italic">need</em>.
        </p>
      </aside>

      <section className="flex flex-1 flex-col px-6 pb-12 pt-9 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h1 className={h1}>{title}</h1>
          {lead && <p className="mt-3 text-[15px] leading-relaxed text-muted">{lead}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-[15px] text-muted">{footer}</div>}
          <p className="mt-12 text-xs text-subtle">Payments run in Stripe test mode, so nothing is charged.</p>
        </div>
      </section>
    </main>
  );
}
