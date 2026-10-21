// Owner: Recipes & Cook. The recipe library (RCP3, design frame 3 "Browse library"): search, quick
// filter chips, and cards with time, cost per serving and the fridge item each dish would use.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { formatUsd } from "@/platform/money";
import * as recipes from "@/modules/recipes";
import type { LibraryCard } from "@/modules/recipes";
import { Mascot } from "./Mascot";
import { RecipeArt } from "./RecipeArt";
import { FunStyles } from "./fun";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Quick filters from the design, each a plain test on a card. */
const CHIPS: { key: string; label: string; emoji: string; test: (r: LibraryCard) => boolean }[] = [
  { key: "fridge", label: "Uses your fridge", emoji: "🧊", test: (r) => r.usesFridge !== null },
  { key: "cooknow", label: "Cook now", emoji: "🔥", test: (r) => r.coverage >= 1 },
  { key: "quick", label: "Quick ≤ 20 min", emoji: "⚡", test: (r) => r.minutes <= 20 },
  { key: "vegetarian", label: "Vegetarian", emoji: "🥦", test: (r) => r.tags.includes("vegetarian") || r.tags.includes("vegan") },
  { key: "onepan", label: "One pan", emoji: "🍳", test: (r) => r.tags.includes("one-pan") || r.equipment.length === 1 },
  { key: "protein", label: "High protein", emoji: "💪", test: (r) => r.tags.includes("high-protein") },
];

/** A greeting that fits the time of day in Los Angeles (the app's one region). */
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }).format(new Date()));
  if (h < 11) return "Good morning! Planning ahead? ☀️";
  if (h < 16) return "What sounds good for dinner? 🍽️";
  return "What are we cooking tonight? 🍳";
}

function daysLabel(d: number | null): string {
  if (d === null) return "";
  if (d < 0) return " (past its date)";
  if (d === 0) return " (today)";
  return ` (${d} day${d === 1 ? "" : "s"})`;
}

export default async function RecipesPage(props: PageProps<"/recipes">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const sp = await props.searchParams;
  const q = one(sp.q).trim();
  const active = new Set(one(sp.chips).split(",").filter((k) => CHIPS.some((c) => c.key === k)));

  const cards = await recipes.libraryCards(user.id);
  const matched = q ? new Set((await recipes.list(user.id, { q })).items.map((r) => r.id)) : null;
  const shown = cards.filter((r) => (!matched || matched.has(r.id)) && CHIPS.every((c) => !active.has(c.key) || c.test(r)));

  const href = (key: string) => {
    const next = new Set(active);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (next.size) params.set("chips", [...next].join(","));
    const s = params.toString();
    return s ? `/recipes?${s}` : "/recipes";
  };

  return (
    <section className="mx-auto w-full max-w-5xl p-6">
      <FunStyles />
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-amber-50 p-5 dark:bg-amber-950/40">
        <div className="flex items-center gap-4">
          <Mascot mood="happy" size={72} className="cooky-float shrink-0" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{greeting()}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{cards.length} cozy dinners for one or two, each with a shopping list in real package sizes.</p>
          </div>
        </div>
        <Link href="/plan" className="rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-800">Plan my week →</Link>
      </div>

      <form method="get" className="mt-6">
        {active.size > 0 && <input type="hidden" name="chips" value={[...active].join(",")} />}
        <label className="sr-only" htmlFor="recipe-search">Search recipes</label>
        <input
          id="recipe-search"
          name="q"
          defaultValue={q}
          placeholder={`Search ${cards.length} recipes, ingredients, cuisines`}
          className="w-full rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm shadow-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </form>

      <nav aria-label="Quick filters" className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <Link
            key={c.key}
            href={href(c.key)}
            aria-pressed={active.has(c.key)}
            className={`rounded-full border px-3 py-1 text-sm transition active:scale-95 ${active.has(c.key) ? "border-green-700 bg-green-700 text-white" : "border-zinc-300 bg-white hover:border-green-600 hover:bg-green-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"}`}
          >
            <span aria-hidden>{c.emoji} </span>{c.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs text-zinc-500">
        {shown.length} of {cards.length} recipes match · tap + to pick for a plan
      </p>

      {shown.length === 0 ? (
        <div className="mt-6 flex items-center gap-4 rounded-3xl border border-dashed border-zinc-300 p-6 text-sm dark:border-zinc-700">
          <Mascot mood="worried" size={56} className="shrink-0" />
          {cards.length === 0 ? (
            <p>The recipe library is empty. Load the seed data with <code>npm run seed</code>.</p>
          ) : active.has("fridge") || active.has("cooknow") ? (
            <p>Nothing matches what is in your fridge yet. <Link className="underline" href="/fridge">Stock your fridge</Link> or <Link className="underline" href="/recipes">clear filters</Link>.</p>
          ) : (
            <p>No recipe matches. <Link className="underline" href="/recipes">Clear filters</Link>.</p>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((r) => (
            <li key={r.id} className="group cooky-pop relative flex flex-col rounded-3xl border border-zinc-200 bg-white p-2.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <Link href={`/recipes/${r.id}`} className="flex flex-1 flex-col">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external https images from the seed, no loader configured
                  <img src={r.imageUrl} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                ) : (
                  <RecipeArt id={r.id} title={r.title} />
                )}
                <h2 className="mt-2 px-1 text-sm font-semibold leading-snug">{r.title}</h2>
                <p className="mt-0.5 px-1 text-xs text-zinc-500">
                  ⏱ {r.minutes} min{r.perServingCents !== null ? ` · ≈ ${formatUsd(r.perServingCents)}/serving` : ""}
                </p>
                {r.usesFridge && (
                  <p className="mx-1 mt-2 w-fit rounded-full bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                    Uses your {r.usesFridge.name.toLowerCase()}{daysLabel(r.usesFridge.daysLeft)}
                  </p>
                )}
              </Link>
              <Link
                href={`/plan?recipes=${r.id}`}
                aria-label={`Pick ${r.title} for a plan`}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg leading-none shadow ring-1 ring-zinc-200 transition hover:scale-110 hover:bg-green-700 hover:text-white active:scale-95 dark:bg-zinc-900 dark:ring-zinc-700"
              >
                +
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
