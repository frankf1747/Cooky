import Link from "next/link";

const LINKS = [
  { href: "/fridge", label: "Fridge" },
  { href: "/plan", label: "Plan" },
  { href: "/receipts/new", label: "Scan receipt" },
  { href: "/recipes", label: "Recipes" },
  { href: "/preferences", label: "Preferences" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Pro" },
];

export function Nav({ email }: { email: string }) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
        <Link href="/fridge" className="mr-2 text-lg font-semibold">
          Cooky
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
            {l.label}
          </Link>
        ))}
        <span className="ml-auto text-zinc-500">{email}</span>
        <form action="/auth/signout" method="post">
          <button className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Sign out</button>
        </form>
      </nav>
    </header>
  );
}
