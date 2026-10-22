"use client";
// Owner: Platform. The app's navigation. Sections follow the journey (plan, shop, scan, cook);
// account things live in one menu. On phones the sections are a bottom tab bar with icons, since
// Cooky is used one-handed in the store and the kitchen, and the header keeps only the wordmark
// and a round account button.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarCheck, House, Receipt, Snowflake, type Icon } from "@phosphor-icons/react";

const SECTIONS: { href: string; label: string; match: string[]; icon: Icon }[] = [
  { href: "/home", label: "Home", match: ["/home"], icon: House },
  { href: "/recipes", label: "Recipes", match: ["/recipes", "/cook"], icon: BookOpen },
  { href: "/plan", label: "Plan", match: ["/plan", "/shop"], icon: CalendarCheck },
  { href: "/fridge", label: "Fridge", match: ["/fridge"], icon: Snowflake },
  { href: "/receipts/new", label: "Receipts", match: ["/receipts"], icon: Receipt },
];

function isActive(pathname: string, match: string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export function AppNav({ email, pro }: { email: string; pro: boolean }) {
  const pathname = usePathname();
  const initial = (email[0] ?? "?").toUpperCase();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-background/95 backdrop-blur dark:border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/home" className="text-lg font-semibold tracking-tight">Cooky</Link>
          <nav aria-label="Sections" className="hidden items-center gap-1 sm:flex">
            {SECTIONS.map((s) => {
              const on = isActive(pathname, s.match);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${on ? "bg-accent-soft font-medium" : "text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!pro && (
              <Link href="/billing" className="hidden rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 sm:inline-flex dark:border-zinc-700 dark:hover:bg-zinc-800">
                Unlock Pro
              </Link>
            )}
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full text-sm [&::-webkit-details-marker]:hidden sm:rounded-lg sm:px-2 sm:py-1">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold sm:h-7 sm:w-7 sm:text-xs">{initial}</span>
                <span className="hidden max-w-40 truncate text-zinc-600 sm:inline dark:text-zinc-400">{email}</span>
                <span className="sr-only">Account menu</span>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-lg border border-zinc-200 bg-surface p-1 text-sm shadow-lg shadow-zinc-900/10 dark:border-zinc-800">
                <p className="truncate px-3 pt-2 text-xs text-zinc-500">{email}</p>
                <p className="px-3 pb-2 text-xs text-zinc-500">{pro ? "Cooky Pro" : "Free plan"}</p>
                <Link href="/settings" className="block rounded-md px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">Settings</Link>
                <Link href="/preferences" className="block rounded-md px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">Taste preferences</Link>
                <Link href="/billing" className="block rounded-md px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">{pro ? "Your Pro plan" : "Unlock Pro"}</Link>
                <form action="/auth/signout" method="post">
                  <button className="w-full rounded-md px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800">
        <ul className="grid grid-cols-5">
          {SECTIONS.map((s) => {
            const on = isActive(pathname, s.match);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[11px] ${on ? "font-semibold text-accent" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  <s.icon size={24} weight={on ? "fill" : "regular"} aria-hidden />
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
