// Owner: Recipes & Cook. The recipe library (RCP3): search, quick filters, and cards where the
// food leads: the dish in the bun's dome, its name, time and cost per serving, and the fridge
// item it would use up. Colour on a card means something (tomato = use soon), never decoration.
import Link from "next/link";
import { redirect } from "next/navigation";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react/ssr";
import { getSessionUser, isPro } from "@/platform/auth";
import { formatUsd } from "@/platform/money";
import * as recipes from "@/modules/recipes";
import type { LibraryCard } from "@/modules/recipes";
import { RecipeImage } from "./RecipeImage";
import { EmptyState, Page } from "@/ui/Page";
import { PlanPickButton, PlanPicksBar } from "@/ui/PlanPick";
import { btnPrimary, btnSecondary, chip, chipOff, chipOn, chipRow, field, h3, tag, tagNeutral, tagPast, tagPro } from "@/ui/styles";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Quick filters, each a plain test on a card. */
const CHIPS: { key: string; label: string; test: (r: LibraryCard) => boolean }[] = [
  { key: "mine", label: "Your recipes", test: (r) => r.custom },
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
  if (d < 0) return ", past its date";
  if (d === 0) return ", today";
  return `, ${d} day${d === 1 ? "" : "s"}`;
}

export default async function RecipesPage(props: PageProps<"/recipes">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const sp = await props.searchParams;
  const q = one(sp.q).trim();
  const active = new Set(one(sp.chips).split(",").filter((k) => CHIPS.some((c) => c.key === k)));

  const [cards, pro] = await Promise.all([recipes.libraryCards(user.id), isPro(user.id)]);
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
      kicker="The library"
      tone="cook"
      title="What's for dinner?"
      description={`${cards.length} dinners for one or two. Tap + to put one in your plan.`}
      width="wide"
      actions={
        <Link href="/recipes/import" className={btnSecondary}>
          <Plus size={18} weight="bold" aria-hidden />
          Add a recipe
          {!pro && <span className={`${tagPro} ml-0.5`}>Pro</span>}
        </Link>
      }
    >
      <PlanPicksBar />
      <form method="get" role="search" className="relative max-w-xl">
        {active.size > 0 && <input type="hidden" name="chips" value={[...active].join(",")} />}
        <label className="sr-only" htmlFor="recipe-search">Search recipes</label>
        <MagnifyingGlass size={20} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          id="recipe-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search dishes, ingredients, cuisines"
          className={`${field} !rounded-full !pl-11`}
        />
      </form>

      <nav aria-label="Quick filters" className={`mt-4 ${chipRow}`}>
        {CHIPS.map((c) => (
          <Link key={c.key} href={href(c.key)} aria-pressed={active.has(c.key)} className={`${chip} ${active.has(c.key) ? chipOn : chipOff}`}>
            {c.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {shown.length === cards.length ? `All ${cards.length} recipes` : `${shown.length} of ${cards.length} recipes`}
      </p>

      {shown.length === 0 ? (
        cards.length > 0 && active.has("mine") && !cards.some((c) => c.custom) ? (
          <EmptyState
            className="mt-6"
            mood="encouraging"
            pose="hold"
            prop="spoon"
            title="No recipes of your own yet"
            action={<><Link className={btnPrimary} href="/recipes/import">Add a recipe</Link><Link className={btnSecondary} href="/recipes">Clear the filters</Link></>}
          >
            Tell me what you feel like eating and I&apos;ll write it up for your library.
          </EmptyState>
        ) : (
          <EmptyState
            className="mt-6"
            mood={cards.length === 0 ? "confused" : "thinking"}
            title={cards.length === 0 ? "The library is empty" : active.has("fridge") || active.has("cooknow") ? "Nothing in the fridge fits yet" : "Nothing by that name"}
            action={cards.length === 0 ? undefined : active.has("fridge") || active.has("cooknow") ? (
              <><Link className={btnPrimary} href="/fridge">Stock the fridge</Link><Link className={btnSecondary} href="/recipes">Clear the filters</Link></>
            ) : (
              <Link className={btnSecondary} href="/recipes">Clear the filters</Link>
            )}
          >
            {cards.length === 0 ? <>Load the seed data with <code>npm run seed</code>.</> : "I checked twice. Try fewer filters or another word."}
          </EmptyState>
        )
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
          {shown.map((r, i) => (
            <li key={r.id} className="rise-in relative" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <Link href={`/recipes/${r.id}`} className="group block">
                <RecipeImage id={r.id} imageUrl={r.imageUrl} title={r.title} className="aspect-[4/3] w-full transition duration-300 group-hover:-translate-y-1" />
                <h2 className={`mt-3 line-clamp-2 ${h3} !text-[17px] sm:!text-lg`}>{r.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {r.minutes} min{r.perServingCents !== null && <> · about {formatUsd(r.perServingCents)} a serving</>}
                </p>
                {r.custom && <p className={`mt-2 ${tagNeutral}`}>Yours</p>}
                {r.usesFridge && (
                  <p className={`mt-2 ${r.usesFridge.daysLeft !== null && r.usesFridge.daysLeft < 0 ? tagPast : tag}`}>
                    Uses your {r.usesFridge.name.toLowerCase()}{daysLabel(r.usesFridge.daysLeft)}
                  </p>
                )}
              </Link>
              <PlanPickButton dish={{ id: r.id, title: r.title }} className="absolute right-2 top-2" />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
