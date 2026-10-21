// Owner: Recipes & Cook. The recipe library (RCP3, design frame 3 "Browse library"): search, quick
// filter chips, and cards with time, cost per serving and the fridge item each dish would use.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { formatUsd } from "@/platform/money";
import * as recipes from "@/modules/recipes";
import type { LibraryCard } from "@/modules/recipes";
import { RecipeArt } from "./RecipeArt";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Quick filters from the design, each a plain test on a card. */
const CHIPS: { key: string; label: string; test: (r: LibraryCard) => boolean }[] = [
  { key: "fridge", label: "Uses your fridge", test: (r) => r.usesFridge !== null },
  { key: "cooknow", label: "Cook now", test: (r) => r.coverage >= 1 },
  { key: "quick", label: "Quick ≤ 20 min", test: (r) => r.minutes <= 20 },
  { key: "vegetarian", label: "Vegetarian", test: (r) => r.tags.includes("vegetarian") || r.tags.includes("vegan") },
  { key: "onepan", label: "One pan", test: (r) => r.tags.includes("one-pan") || r.equipment.length === 1 },
  { key: "protein", label: "High protein", test: (r) => r.tags.includes("high-protein") },
];

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
          <p className="mt-1 text-sm text-zinc-500">Dinners for one or two, each with a shopping list in real package sizes.</p>
        </div>
        <Link href="/plan" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">Plan meals</Link>
      </div>

      <form method="get" className="mt-6">
        {active.size > 0 && <input type="hidden" name="chips" value={[...active].join(",")} />}
        <label className="sr-only" htmlFor="recipe-search">Search recipes</label>
        <input
          id="recipe-search"
          name="q"
          defaultValue={q}
          placeholder={`Search ${cards.length} recipes, ingredients, cuisines`}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-4 py-2.5 text-sm dark:border-zinc-700"
        />
      </form>

      <nav aria-label="Quick filters" className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <Link
            key={c.key}
            href={href(c.key)}
            aria-pressed={active.has(c.key)}
            className={`rounded-full border px-3 py-1 text-sm ${active.has(c.key) ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"}`}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs text-zinc-500">
        {shown.length} of {cards.length} recipes match · tap + to pick for a plan
      </p>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-6 text-sm dark:border-zinc-700">
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
            <li key={r.id} className="relative flex flex-col rounded-xl border border-zinc-200 p-2.5 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
              <Link href={`/recipes/${r.id}`} className="flex flex-1 flex-col">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external https images from the seed, no loader configured
                  <img src={r.imageUrl} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                ) : (
                  <RecipeArt id={r.id} />
                )}
                <h2 className="mt-2 text-sm font-semibold leading-snug">{r.title}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {r.minutes} min{r.perServingCents !== null ? ` · ≈ ${formatUsd(r.perServingCents)}/serving` : ""}
                </p>
                {r.usesFridge && (
                  <p className="mt-2 w-fit rounded-md bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                    Uses your {r.usesFridge.name.toLowerCase()}{daysLabel(r.usesFridge.daysLeft)}
                  </p>
                )}
              </Link>
              <Link
                href={`/plan?recipes=${r.id}`}
                aria-label={`Pick ${r.title} for a plan`}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white text-lg leading-none shadow ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700"
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
