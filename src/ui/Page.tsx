// Owner: Platform. The frame every signed-in page uses: one width, a title with a one-line
// explanation, the page's main action at the top right, and an optional link back.
import Link from "next/link";
import type { ReactNode } from "react";

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
    <section className={`mx-auto w-full ${WIDTHS[width]} px-4 pb-24 pt-6 sm:px-6 sm:pb-12`}>
      {back && (
        <Link href={back.href} className="text-sm text-zinc-600 hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50">
          {back.label}
        </Link>
      )}
      <header className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${back ? "mt-2" : ""}`}>
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A section inside a page: a heading, an optional note, and its content. */
export function Section({ title, note, actions, children }: { title: ReactNode; note?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
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
    <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
