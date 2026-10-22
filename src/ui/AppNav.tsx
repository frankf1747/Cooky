"use client";
// Owner: Platform. The app's navigation, in the order the week flows: find dishes (Recipes), plan
// them (Plan), the Fridge in the middle (the landing page, raised so it stands out), put
// shopping away (Stock: scan the receipt into the fridge), and Cook. Account things live in one
// menu. On phones the sections are a bottom tab bar, since Cooky is used one-handed in the
// store and the kitchen. The Plan tab counts the dishes picked so far. A cooking session
// (/cook/<recipe>) is a focused screen with its own way out, so the nav steps aside there.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, CalendarCheck, CookingPot, Snowflake, TrayArrowDown, type Icon } from "@phosphor-icons/react";
import { Bao } from "./Bao";
import { planPicks, usePlanPicks } from "./planPicks";

type SectionLink = { href: string; label: string; match: string[]; icon: Icon; center?: boolean; counts?: boolean };

const SECTIONS: SectionLink[] = [
  { href: "/recipes", label: "Recipes", match: ["/recipes"], icon: BookOpenText },
  { href: "/plan", label: "Plan", match: ["/plan", "/shop", "/preferences"], icon: CalendarCheck, counts: true },
  { href: "/fridge", label: "Fridge", match: ["/fridge"], icon: Snowflake, center: true },
  { href: "/receipts/new", label: "Stock", match: ["/receipts"], icon: TrayArrowDown },
  { href: "/cook", label: "Cook", match: ["/cook"], icon: CookingPot },
];

function isActive(pathname: string, match: string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** The Cooky mark: Bao's head and hat, and the wordmark. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Bao size={34} ground={false} decorative className="-mb-1 -ml-1" />
      <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">Cooky</span>
    </span>
  );
}

function Count({ n, className = "" }: { n: number; className?: string }) {
  if (n === 0) return null;
  return (
    <span className={`pop-in flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-none text-on-accent tabular-nums ${className}`}>
      {n}
      <span className="sr-only"> {n === 1 ? "dish" : "dishes"} picked</span>
    </span>
  );
}

export function AppNav({ email, pro }: { email: string; pro: boolean }) {
  const pathname = usePathname();
  const picks = usePlanPicks();
  if (pathname.startsWith("/cook/")) return null;
  const initial = (email[0] ?? "?").toUpperCase();
  const closeMenu = (e: React.MouseEvent<HTMLElement>) => {
    const menu = e.currentTarget.closest("details");
    if (menu) menu.open = false;
  };
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/fridge" aria-label="Cooky, your fridge" className="rounded-full">
            <Wordmark />
          </Link>
          <nav aria-label="Sections" className="hidden h-full items-stretch gap-1 sm:flex">
            {SECTIONS.map((s) => {
              const on = isActive(pathname, s.match);
              if (s.center) {
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    aria-current={on ? "page" : undefined}
                    className={`mx-2 flex items-center gap-2 self-center rounded-full px-4 py-2 text-[15px] font-medium transition active:scale-[0.97] ${on ? "bg-cobalt-deep text-on-brand" : "bg-cobalt-tint text-cobalt-ink hover:brightness-95"}`}
                  >
                    <s.icon size={18} weight="fill" aria-hidden />
                    {s.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 px-3 text-[15px] transition after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition ${on ? "font-medium text-foreground after:bg-foreground" : "text-muted after:bg-transparent hover:text-foreground"}`}
                >
                  {s.label}
                  {s.counts && <Count n={picks.length} />}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {!pro && (
              <Link href="/billing" className="hidden h-9 items-center rounded-full bg-crust-tint px-4 text-sm font-medium text-crust-ink transition hover:brightness-95 lg:inline-flex">
                Unlock Pro
              </Link>
            )}
            <details className="relative">
              <summary className="flex h-11 cursor-pointer list-none items-center rounded-full [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-crust-tint font-display text-base font-semibold text-crust-ink">{initial}</span>
                <span className="sr-only">Account menu</span>
              </summary>
              <div onClick={closeMenu} className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 text-[15px] shadow-float">
                <div className="px-3 pb-2 pt-2">
                  <p className="truncate text-sm font-medium">{email}</p>
                  <p className="mt-0.5 text-xs text-muted">{pro ? "Cooky Pro" : "Free plan"}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link href="/settings" className="flex h-11 items-center rounded-xl px-3 hover:bg-sunken">Settings</Link>
                <Link href="/preferences" className="flex h-11 items-center rounded-xl px-3 hover:bg-sunken">Taste preferences</Link>
                <Link href="/billing" className="flex h-11 items-center rounded-xl px-3 hover:bg-sunken">{pro ? "Your Pro plan" : "Unlock Pro"}</Link>
                <div className="my-1 h-px bg-line" />
                <form action="/auth/signout" method="post" onSubmit={() => planPicks.clear()}>
                  <button className="flex h-11 w-full items-center rounded-xl px-3 text-left text-muted hover:bg-sunken hover:text-foreground">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <ul className="grid grid-cols-5">
          {SECTIONS.map((s) => {
            const on = isActive(pathname, s.match);
            if (s.center) {
              return (
                <li key={s.href} className="flex justify-center">
                  <Link href={s.href} aria-current={on ? "page" : undefined} className="-mt-5 flex flex-col items-center gap-1 text-[11px]">
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full bg-cobalt-deep text-on-brand shadow-float ring-4 ring-surface transition active:scale-95 ${on ? "" : "opacity-95"}`}>
                      <s.icon size={26} weight="fill" aria-hidden />
                    </span>
                    <span className={on ? "font-semibold text-foreground" : "text-muted"}>{s.label}</span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${on ? "font-semibold text-foreground" : "text-muted"}`}
                >
                  <span className={`relative flex h-7 w-14 items-center justify-center rounded-full transition ${on ? "bg-accent-soft text-accent" : ""}`}>
                    <s.icon size={22} weight={on ? "fill" : "regular"} aria-hidden />
                    {s.counts && <Count n={picks.length} className="absolute -right-0.5 -top-1.5" />}
                  </span>
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
