// Owner: Platform. The frame every signed-in page uses: one width, an optional way back, a small
// kicker that says where you are (with the step's colour dot), one big title, at most one line
// of explanation, and the page's main action. On phones the actions sit under the title at full
// width, where a thumb reaches them; on larger screens they sit at the top right. The bottom
// padding leaves room for the tab bar.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { Bao, type BaoMood, type BaoPose, type BaoProp } from "./Bao";
import { h1, h2, tones, type Tone } from "./styles";

const WIDTHS = { narrow: "max-w-2xl", normal: "max-w-4xl", wide: "max-w-6xl" } as const;

export function Page({
  title,
  kicker,
  tone,
  description,
  actions,
  back,
  width = "normal",
  children,
}: {
  title: ReactNode;
  /** A few words above the title: the step of the week, or the kind of page. */
  kicker?: ReactNode;
  /** The step's colour, shown as a dot before the kicker. */
  tone?: Tone;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  return (
    <section className={`mx-auto w-full ${WIDTHS[width]} px-4 pb-32 pt-4 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8`}>
      {back && <BackLink {...back} />}
      <header className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-5 ${back ? "mt-3" : "mt-2"}`}>
        <div className="min-w-0 max-w-2xl">
          {kicker && <Kicker tone={tone}>{kicker}</Kicker>}
          <h1 className={`${h1} ${kicker ? "mt-3" : ""}`}>{title}</h1>
          {description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </header>
      <div className="mt-7 sm:mt-10">{children}</div>
    </section>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm text-muted transition hover:bg-sunken hover:text-foreground">
      <ArrowLeft size={16} aria-hidden />
      {label}
    </Link>
  );
}

/** The small label above a title, with the step's colour as a dot. */
export function Kicker({ tone, children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-[13px] font-medium leading-none text-muted ${className}`}>
      {tone && <span aria-hidden className={`h-2 w-2 rounded-full ${tones[tone].dot}`} />}
      {children}
    </p>
  );
}

/** A section inside a page: a heading, an optional note, an optional action on the right. */
export function Section({ title, note, actions, children, className = "" }: { title: ReactNode; note?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-12 first:mt-0 sm:mt-14 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className={h2}>{title}</h2>
        {actions && <div className="text-sm">{actions}</div>}
      </div>
      {note && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** What an empty list says: Bao, what goes here, and the one thing to do about it. */
export function EmptyState({
  title,
  children,
  action,
  mood = "welcoming",
  pose = "rest",
  prop = "none",
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  mood?: BaoMood;
  pose?: BaoPose;
  prop?: BaoProp;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-3xl bg-sunken/60 px-6 py-10 text-center sm:py-12 ${className}`}>
      <Bao mood={mood} pose={pose} prop={prop} size={84} decorative />
      <p className="mt-3 font-display text-xl font-semibold tracking-[-0.01em]">{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
