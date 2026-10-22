"use client";
// Owner: Platform. The app's navigation. Sections follow the journey (plan, shop, scan, cook);
// account things live in one menu. On phones the sections become a bottom tab bar, since Cooky
// is used one-handed in the store and the kitchen.
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/home", label: "Home", match: ["/home"] },
  { href: "/recipes", label: "Recipes", match: ["/recipes", "/cook"] },
  { href: "/plan", label: "Plan", match: ["/plan", "/shop"] },
  { href: "/fridge", label: "Fridge", match: ["/fridge"] },
  { href: "/receipts/new", label: "Receipts", match: ["/receipts"] },
];

function isActive(pathname: string, match: string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export function AppNav({ email, pro }: { email: string; pro: boolean }) {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[var(--background)]/95 backdrop-blur dark:border-zinc-800">
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
                  className={`rounded-md px-3 py-1.5 text-sm ${on ? "bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"}`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {!pro && (
              <Link href="/billing" className="hidden rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 sm:inline-flex dark:border-zinc-700 dark:hover:bg-zinc-900">
                Unlock Pro
              </Link>
            )}
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 [&::-webkit-details-marker]:hidden">
                <span className="max-w-40 truncate">{email}</span>
                <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
                <span className="sr-only">Account menu</span>
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-zinc-200 bg-[var(--background)] p-1 text-sm shadow-lg dark:border-zinc-800">
                <p className="px-3 py-2 text-xs text-zinc-500">{pro ? "Cooky Pro" : "Free plan"}</p>
                <Link href="/settings" className="block rounded-md px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">Settings</Link>
                <Link href="/preferences" className="block rounded-md px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">Taste preferences</Link>
                <Link href="/billing" className="block rounded-md px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">{pro ? "Your Pro plan" : "Unlock Pro"}</Link>
                <form action="/auth/signout" method="post">
                  <button className="w-full rounded-md px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-[var(--background)] pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-zinc-800">
        <ul className="grid grid-cols-5">
          {SECTIONS.map((s) => {
            const on = isActive(pathname, s.match);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-14 items-center justify-center text-xs ${on ? "font-semibold text-zinc-950 dark:text-zinc-50" : "text-zinc-500"}`}
                >
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
