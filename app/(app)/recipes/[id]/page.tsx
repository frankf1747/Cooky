// Owner: Recipes & Cook. One recipe (RCP3): a prep checklist, steps with timers and tips, FAQs,
// and the source.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Recipe } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import * as recipes from "@/modules/recipes";
import { RecipeImage } from "../RecipeImage";
import { formatTimer } from "../ui";
import { PrepChecklist } from "./PrepChecklist";

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
      <Link href="/recipes" className="text-sm text-zinc-500 hover:underline">All recipes</Link>

      <div className="mt-3 flex flex-wrap items-start gap-5">
        <RecipeImage imageUrl={recipe.imageUrl} title={recipe.title} className="h-32 w-44 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {recipe.minutes} min · serves {recipe.baseServings} · {recipe.equipment.join(", ") || "no special equipment"}
          </p>
          {recipe.tags.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {recipe.tags.map((t) => (
                <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{t}</span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/cook/${recipe.id}`} className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">Start cooking</Link>
        <Link href={`/plan?recipes=${recipe.id}`} className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">Add to a plan</Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Ingredients <span className="text-sm font-normal text-zinc-500">for {recipe.baseServings}</span></h2>
      <PrepChecklist ingredients={recipe.ingredients} />

      <h2 className="mt-8 text-lg font-semibold">Steps</h2>
      {steps.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">This recipe has no steps yet.</p>
      ) : (
        <ol className="mt-3 space-y-3 text-sm">
          {steps.map((s) => (
            <li key={s.id} className="flex gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <span className="w-6 shrink-0 font-semibold tabular-nums">{s.stepNo}.</span>
              <div className="flex-1">
                <p className="leading-relaxed">{s.text}</p>
                {s.timerSeconds && <p className="mt-1 text-xs text-zinc-500">Timer {formatTimer(s.timerSeconds)}</p>}
                {tipFor.get(s.stepNo) && <p className="mt-2 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs dark:bg-zinc-800">Tip: {tipFor.get(s.stepNo)!.text}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {recipe.faqs.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Questions cooks ask</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {recipe.faqs.map((f) => (
              <details key={f.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <summary className="cursor-pointer font-medium">{f.label.replace(/^FAQ:\s*/, "").replace(/^./, (c) => c.toUpperCase())}</summary>
                <p className="mt-1.5 text-zinc-600 dark:text-zinc-400">{f.text}</p>
              </details>
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-xs text-zinc-500">
        Source: {recipe.sourceUrl ? <a href={recipe.sourceUrl} className="underline" rel="noopener noreferrer" target="_blank">{recipe.sourceLabel}</a> : recipe.sourceLabel}
      </p>
    </section>
  );
}
