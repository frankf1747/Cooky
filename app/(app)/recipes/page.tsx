// Owner: Recipes & Cook. The recipe library (RCP3): search, tag, time, equipment and "cook now" filters.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import * as recipes from "@/modules/recipes";
import { MINUTE_CHOICES } from "./ui";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function RecipesPage(props: PageProps<"/recipes">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const sp = await props.searchParams;
  const q = one(sp.q).trim();
  const tag = one(sp.tag);
  const maxMinutes = Number(one(sp.max)) || null;
  const equipment = one(sp.equipment);
  const cookable = one(sp.cookable) === "true";

  // Tags and equipment come from the whole library so the filters never hide their own options.
  const all = (await recipes.list(user.id, {})).items;
  const { items } = await recipes.list(user.id, { q: q || undefined, tag: tag || undefined, cookableNow: cookable ? "true" : undefined });
  const shown = items.filter((r) => (!maxMinutes || r.minutes <= maxMinutes) && (!equipment || r.equipment.includes(equipment)));
  const tags = [...new Set(all.flatMap((r) => r.tags))].sort();
  const equipments = [...new Set(all.flatMap((r) => r.equipment))].sort();
  const filtered = Boolean(q || tag || maxMinutes || equipment || cookable);

  return (
    <section className="mx-auto w-full max-w-5xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
          <p className="mt-1 text-sm text-zinc-500">{all.length} dinners written for one or two people, each with a shopping list in real package sizes.</p>
        </div>
        <Link href="/plan" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">Plan meals</Link>
      </div>

      <form method="get" className="mt-6 grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end dark:border-zinc-800">
        <label className="text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Search</span>
          <input name="q" defaultValue={q} placeholder="chicken, rice, quick…" className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 dark:border-zinc-700" />
        </label>
        <label className="text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Tag</span>
          <select name="tag" defaultValue={tag} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700">
            <option value="">Any</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Time</span>
          <select name="max" defaultValue={maxMinutes ?? ""} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700">
            <option value="">Any</option>
            {MINUTE_CHOICES.map((m) => <option key={m} value={m}>≤ {m} min</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Equipment</span>
          <select name="equipment" defaultValue={equipment} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700">
            <option value="">Any</option>
            {equipments.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="cookable" value="true" defaultChecked={cookable} /> Cook now
          </label>
          <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">Filter</button>
        </div>
      </form>
      {cookable && <p className="mt-2 text-xs text-zinc-500">Cook now shows recipes whose required ingredients are all in your fridge, dishes that use food with the soonest typical dates first.</p>}

      {shown.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-6 text-sm dark:border-zinc-700">
          {cookable ? (
            <p>Nothing can be cooked entirely from your fridge yet. <Link className="underline" href="/fridge">Stock your fridge</Link> or <Link className="underline" href="/recipes">see every recipe</Link>.</p>
          ) : filtered ? (
            <p>No recipe matches these filters. <Link className="underline" href="/recipes">Clear filters</Link>.</p>
          ) : (
            <p>The recipe library is empty. Load the seed data with <code>npm run seed</code>.</p>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/recipes/${r.id}`} className="flex h-full flex-col rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
                {r.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- external https images from the seed, no loader configured
                  <img src={r.imageUrl} alt="" className="mb-3 aspect-video w-full rounded-md object-cover" />
                )}
                <h2 className="font-medium">{r.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{r.minutes} min · serves {r.baseServings}{r.custom ? " · yours" : ""}</p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {r.tags.map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{t}</span>)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
