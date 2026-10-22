// Owner: Recipes & Cook. The recipe library (RCP3): search, quick filters, and cards with time,
// cost per serving and the fridge item each dish would use.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { formatUsd } from "@/platform/money";
import * as recipes from "@/modules/recipes";
import type { LibraryCard } from "@/modules/recipes";
import { RecipeImage } from "./RecipeImage";
import { Page } from "@/ui/Page";
import { btnPrimary, btnText, chip, chipOff, chipOn, chipRow, field, tag } from "@/ui/styles";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Quick filters, each a plain test on a card. */
const CHIPS: { key: string; label: string; test: (r: LibraryCard) => boolean }[] = [
  { key: "fridge", label: "Uses your fridge", test: (r) => r.usesFridge !== null },
  { key: "cooknow", label: "Cook now", test: (r) => r.coverage >= 1 },
  { key: "quick", label: "20 min or less", test: (r) => r.minutes <= 20 },
  { key: "vegetarian", label: "Vegetarian", test: (r) => r.tags.includes("vegetarian") || r.tags.includes("vegan") },
  { key: "japanese", label: "Japanese", test: (r) => r.tags.includes("japanese") },
  // Tag only: "lists one piece of equipment" wrongly counted dishes that cook rice in a second pot.
  { key: "onepan", label: "One pan", test: (r) => r.tags.includes("one-pan") },
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
    <Page
      title="Recipes"
      description={`${cards.length} dinners for one or two. Open one to cook it, or add it to a plan.`}
      width="wide"
      actions={<Link href="/plan" className={btnPrimary}>Plan dinners</Link>}
    >
      <form method="get">
        {active.size > 0 && <input type="hidden" name="chips" value={[...active].join(",")} />}
        <label className="sr-only" htmlFor="recipe-search">Search recipes</label>
        <input
          id="recipe-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={`Search ${cards.length} recipes, ingredients, cuisines`}
          className={field}
        />
      </form>

      <nav aria-label="Quick filters" className={`mt-3 ${chipRow}`}>
        {CHIPS.map((c) => (
          <Link key={c.key} href={href(c.key)} aria-pressed={active.has(c.key)} className={`${chip} ${active.has(c.key) ? chipOn : chipOff}`}>
            {c.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs text-zinc-500">{shown.length} of {cards.length} recipes</p>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-surface p-6 text-sm dark:border-zinc-700">
          {cards.length === 0 ? (
            <p>The recipe library is empty. Load the seed data with <code>npm run seed</code>.</p>
          ) : active.has("fridge") || active.has("cooknow") ? (
            <p>Nothing matches what is in your fridge yet. <Link className={btnText} href="/fridge">Stock your fridge</Link> or <Link className={btnText} href="/recipes">clear filters</Link>.</p>
          ) : (
            <p>No recipe matches that. <Link className={btnText} href="/recipes">Clear filters</Link>.</p>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-col rounded-lg border border-zinc-200 bg-surface p-2 dark:border-zinc-800">
              <Link href={`/recipes/${r.id}`} className="flex flex-1 flex-col">
                <RecipeImage imageUrl={r.imageUrl} title={r.title} />
                <h2 className="mt-2 px-1 text-sm font-medium leading-snug">{r.title}</h2>
                <p className="mt-0.5 px-1 text-xs text-zinc-500">
                  {r.minutes} min{r.perServingCents !== null ? ` · about ${formatUsd(r.perServingCents)} per serving` : ""}
                </p>
                {r.usesFridge && (
                  <p className={`mx-1 mt-2 w-fit ${tag}`}>
                    Uses your {r.usesFridge.name.toLowerCase()}
                    {daysLabel(r.usesFridge.daysLeft)}
                  </p>
                )}
              </Link>
              <Link href={`/plan?recipes=${r.id}`} className={`mt-2 px-1 text-xs ${btnText}`}>Add to a plan</Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
