// Owner: Platform. The frame every signed-in page uses: one width, a title with a one-line
// explanation, the page's main action, and an optional link back. On phones the actions sit
// under the title at full width, where a thumb reaches them; on larger screens they sit at the
// top right. The bottom padding leaves room for the tab bar.
import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft } from "@phosphor-icons/react/ssr";

const WIDTHS = { narrow: "max-w-2xl", normal: "max-w-4xl", wide: "max-w-6xl" } as const;

export function Page({
  title,
  description,
  actions,
  back,
  width = "normal",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  return (
    <section className={`mx-auto w-full ${WIDTHS[width]} px-4 pb-28 pt-4 sm:px-6 sm:pb-12 sm:pt-6`}>
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-0.5 text-sm text-zinc-600 hover:text-foreground hover:underline dark:text-zinc-400">
          <CaretLeft size={14} aria-hidden />
          {back.label}
        </Link>
      )}
      <header className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-4 ${back ? "mt-2" : ""}`}>
        <div className="min-w-0 max-w-2xl">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-1 text-sm leading-relaxed text-zinc-600 sm:mt-1.5 sm:text-[15px] dark:text-zinc-400">{description}</p>}
        </div>
        {actions && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </header>
      <div className="mt-5 sm:mt-6">{children}</div>
    </section>
  );
}

/** A section inside a page: a heading, an optional note, and its content. */
export function Section({ title, note, actions, children }: { title: ReactNode; note?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0 sm:mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      {note && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** What an empty list says: what goes here, and the one thing to do about it. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-surface px-6 py-8 text-center dark:border-zinc-700">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
