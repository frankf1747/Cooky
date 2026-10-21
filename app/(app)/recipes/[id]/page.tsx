// Owner: Recipes & Cook. One recipe (RCP3): ingredients, steps with timers and tips, FAQs, source.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Recipe } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import * as recipes from "@/modules/recipes";
import { RecipeArt } from "../RecipeArt";
import { FunStyles } from "../fun";
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
      <FunStyles />
      <Link href="/recipes" className="text-sm text-zinc-500 hover:underline">← Recipes</Link>
      <div className="cooky-pop mt-3 flex items-center gap-5">
        <RecipeArt id={recipe.id} title={recipe.title} className="h-28 w-28 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{recipe.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            ⏱ {recipe.minutes} min · 🍽 serves {recipe.baseServings} · 🍳 {recipe.equipment.join(", ") || "no special equipment"}
          </p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {recipe.tags.map((t) => (
          <Link key={t} href={`/recipes?tag=${encodeURIComponent(t)}`} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:underline dark:bg-zinc-800 dark:text-zinc-300">{t}</Link>
        ))}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/cook/${recipe.id}`} className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-800">Let&apos;s cook! 👩‍🍳</Link>
        <Link href={`/plan?recipes=${recipe.id}`} className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm transition hover:border-green-600 hover:bg-green-50 dark:border-zinc-700 dark:hover:bg-zinc-900">+ Add to a plan</Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold">🧺 Gather your ingredients <span className="text-sm font-normal text-zinc-500">for {recipe.baseServings} · tap to tick off</span></h2>
      <PrepChecklist ingredients={recipe.ingredients} />

      <h2 className="mt-8 text-lg font-semibold">👣 Steps</h2>
      <ol className="mt-2 space-y-3 text-sm">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800 dark:bg-green-950 dark:text-green-300">{s.stepNo}</span>
            <div className="flex-1">
            <p className="font-medium">
              {s.label}
              {s.timerSeconds && <span className="ml-2 text-xs font-normal text-zinc-500">⏱ {formatTimer(s.timerSeconds)}</span>}
            </p>
            <p className="mt-1">{s.text}</p>
            {tipFor.get(s.stepNo) && <p className="mt-2 rounded-xl bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">💡 {tipFor.get(s.stepNo)!.text}</p>}
            </div>
          </li>
        ))}
      </ol>

      {recipe.faqs.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">🙋 Questions cooks ask</h2>
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
