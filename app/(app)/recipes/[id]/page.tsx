// Owner: Recipes & Cook. One recipe (RCP3): ingredients, steps with timers and tips, FAQs, source.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Recipe } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import * as recipes from "@/modules/recipes";
import { formatQty, formatTimer } from "../ui";

export default async function RecipePage(props: PageProps<"/recipes/[id]">) {
  const { id } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let recipe: Recipe;
  try {
    recipe = await recipes.get(user.id, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const steps = recipe.steps.filter((s) => s.kind === "step");
  const tipFor = new Map(recipe.steps.filter((s) => s.kind === "tip").map((t) => [t.stepNo, t]));

  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <Link href="/recipes" className="text-sm text-zinc-500 hover:underline">← Recipes</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{recipe.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {recipe.minutes} min · serves {recipe.baseServings} · {recipe.equipment.join(", ") || "no special equipment"}
      </p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {recipe.tags.map((t) => (
          <Link key={t} href={`/recipes?tag=${encodeURIComponent(t)}`} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:underline dark:bg-zinc-800 dark:text-zinc-300">{t}</Link>
        ))}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/cook/${recipe.id}`} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Start cooking</Link>
        <Link href={`/plan?recipes=${recipe.id}`} className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">Add to a plan</Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Ingredients <span className="text-sm font-normal text-zinc-500">for {recipe.baseServings}</span></h2>
      <ul className="mt-2 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {recipe.ingredients.map((i) => (
          <li key={i.ingredientId} className="flex justify-between gap-4 py-1.5">
            <span>
              {i.name}
              {i.optional && <span className="ml-2 text-xs text-zinc-500">optional</span>}
              {i.note && <span className="block text-xs text-zinc-500">{i.note}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">{formatQty(i.qty, i.unit)}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Steps</h2>
      <ol className="mt-2 space-y-3 text-sm">
        {steps.map((s) => (
          <li key={s.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="font-medium">
              {s.label}
              {s.timerSeconds && <span className="ml-2 text-xs font-normal text-zinc-500">⏱ {formatTimer(s.timerSeconds)}</span>}
            </p>
            <p className="mt-1">{s.text}</p>
            {tipFor.get(s.stepNo) && <p className="mt-2 text-xs text-zinc-500">Tip: {tipFor.get(s.stepNo)!.text}</p>}
          </li>
        ))}
      </ol>

      {recipe.faqs.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Questions cooks ask</h2>
          <dl className="mt-2 space-y-3 text-sm">
            {recipe.faqs.map((f) => (
              <div key={f.id}>
                <dt className="font-medium">{f.label.replace(/^FAQ:\s*/, "")}</dt>
                <dd className="mt-0.5 text-zinc-600 dark:text-zinc-400">{f.text}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <p className="mt-8 text-xs text-zinc-500">
        Source: {recipe.sourceUrl ? <a href={recipe.sourceUrl} className="underline" rel="noopener noreferrer" target="_blank">{recipe.sourceLabel}</a> : recipe.sourceLabel}
      </p>
    </section>
  );
}
