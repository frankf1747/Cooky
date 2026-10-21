// Owner: Recipes & Cook. The recipe library (RCP3, design frame 3 "Browse library"): search, quick
// filter chips, and cards with time, cost per serving and the fridge item each dish would use.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { formatUsd } from "@/platform/money";
import * as recipes from "@/modules/recipes";
import type { LibraryCard } from "@/modules/recipes";
import { maru } from "./font";
import { FunStyles, Sakura, Steam, Washi, ui } from "./fun";
import { Mascot } from "./Mascot";
import { RecipeArt } from "./RecipeArt";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Quick filters from the design, each a plain test on a card. */
const CHIPS: { key: string; label: string; emoji: string; test: (r: LibraryCard) => boolean }[] = [
  { key: "fridge", label: "Uses your fridge", emoji: "🧊", test: (r) => r.usesFridge !== null },
  { key: "cooknow", label: "Cook now", emoji: "🔥", test: (r) => r.coverage >= 1 },
  { key: "quick", label: "Quick ≤ 20 min", emoji: "⚡", test: (r) => r.minutes <= 20 },
  { key: "vegetarian", label: "Vegetarian", emoji: "🥕", test: (r) => r.tags.includes("vegetarian") || r.tags.includes("vegan") },
  { key: "japanese", label: "Japanese", emoji: "🍙", test: (r) => r.tags.includes("japanese") },
  { key: "onepan", label: "One pan", emoji: "🍳", test: (r) => r.tags.includes("one-pan") || r.equipment.length === 1 },
  { key: "protein", label: "High protein", emoji: "💪", test: (r) => r.tags.includes("high-protein") },
];

/** A greeting that fits the time of day in Los Angeles (the app's one region). */
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }).format(new Date()));
  if (h < 11) return "Good morning! Planning ahead?";
  if (h < 16) return "What sounds good for dinner?";
  return "What are we cooking tonight?";
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
    <div className={`${ui.page} ${maru.className}`}>
      <FunStyles />
      <section className="mx-auto w-full max-w-5xl p-6">
        {/* hero: Bao says hi */}
        <div className={`relative flex flex-wrap items-center justify-between gap-4 bg-[#EAF6FB] p-5 shadow-[4px_4px_0_0_#FFB7C5] ${ui.frame} ${ui.wobble}`}>
          <Washi className="-top-2 left-10" />
          <Sakura size={26} className="cooky-float absolute right-28 top-3 opacity-80" />
          <Sakura size={16} className="absolute right-12 bottom-4 opacity-70" />
          <div className="flex items-center gap-4">
            <div className="relative">
              <Steam className="absolute -top-5 left-6" />
              <Mascot mood="happy" size={84} className="cooky-float shrink-0" />
            </div>
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest text-[#E58AA0]`}>Bao&apos;s kitchen</p>
              <h1 className={`text-2xl sm:text-3xl ${ui.heading}`}>{greeting()}</h1>
              <p className={`mt-1 text-sm ${ui.muted}`}>{cards.length} cozy dinners for one or two, each with a shopping list in real package sizes.</p>
            </div>
          </div>
          <Link href="/plan" className={`px-5 py-2.5 text-sm ${ui.btn} ${ui.wobbleSm}`}>Plan my week →</Link>
        </div>

        <form method="get" className="mt-6">
          {active.size > 0 && <input type="hidden" name="chips" value={[...active].join(",")} />}
          <label className="sr-only" htmlFor="recipe-search">Search recipes</label>
          <div className={`flex items-center gap-2 bg-white px-4 py-2 shadow-[3px_3px_0_0_#FFB7C5] ${ui.frame} ${ui.wobbleSm}`}>
            <span aria-hidden>🔍</span>
            <input
              id="recipe-search"
              name="q"
              defaultValue={q}
              placeholder={`Search ${cards.length} recipes, ingredients, cuisines… (typos are ok)`}
              className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-[#9A9DB0]"
            />
          </div>
        </form>

        <nav aria-label="Quick filters" className="mt-4 flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <Link key={c.key} href={href(c.key)} aria-pressed={active.has(c.key)} className={`px-3 py-1 text-sm ${ui.wobbleSm} ${active.has(c.key) ? ui.chipOn : ui.chip}`}>
              <span aria-hidden>{c.emoji} </span>
              {c.label}
            </Link>
          ))}
        </nav>
        <p className={`mt-3 text-xs ${ui.muted}`}>
          {shown.length} of {cards.length} recipes · tap <b>+</b> to pick one for your plan
        </p>

        {shown.length === 0 ? (
          <div className={`mt-6 flex items-center gap-4 p-6 text-sm ${ui.cardSoft} ${ui.wobble}`}>
            <Mascot mood="worried" size={60} className="shrink-0" />
            {cards.length === 0 ? (
              <p>The recipe library is empty. Load the seed data with <code>npm run seed</code>.</p>
            ) : active.has("fridge") || active.has("cooknow") ? (
              <p>Nothing matches what is in your fridge yet. <Link className={ui.link} href="/fridge">Stock your fridge</Link> or <Link className={ui.link} href="/recipes">clear filters</Link>.</p>
            ) : (
              <p>Hmm, no recipe matches that. <Link className={ui.link} href="/recipes">Clear filters</Link>.</p>
            )}
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((r, i) => (
              <li
                key={r.id}
                className={`group cooky-pop relative flex flex-col bg-white p-2.5 shadow-[4px_4px_0_0_#A8D8EA] ${ui.frame} ${ui.wobble} transition duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#FFB7C5] ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"}`}
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <Link href={`/recipes/${r.id}`} className="flex flex-1 flex-col">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external https images from the seed, no loader configured
                    <img src={r.imageUrl} alt="" className={`aspect-[4/3] w-full object-cover ${ui.wobbleSm}`} />
                  ) : (
                    <RecipeArt id={r.id} title={r.title} />
                  )}
                  <h2 className="mt-2 px-1 text-sm font-bold leading-snug">{r.title}</h2>
                  <p className={`mt-0.5 px-1 text-xs ${ui.muted}`}>
                    ⏱ {r.minutes} min{r.perServingCents !== null ? ` · ≈ ${formatUsd(r.perServingCents)}/serving` : ""}
                  </p>
                  {r.usesFridge && (
                    <p className={`mx-1 mt-2 w-fit rounded-full px-2 py-0.5 text-xs font-bold ${ui.tag}`}>
                      🧊 Uses your {r.usesFridge.name.toLowerCase()}
                      {daysLabel(r.usesFridge.daysLeft)}
                    </p>
                  )}
                </Link>
                <Link
                  href={`/plan?recipes=${r.id}`}
                  aria-label={`Pick ${r.title} for a plan`}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#34374A] bg-white text-lg font-bold leading-none shadow-[2px_2px_0_0_#34374A] transition hover:scale-110 hover:bg-[#FFB7C5] active:scale-95"
                >
                  +
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
