// Owner: Recipes & Cook. One recipe (RCP3): a tap-to-tick prep list, steps with timers and tips,
// FAQs, and the source.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Recipe } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import * as recipes from "@/modules/recipes";
import { maru } from "../font";
import { FunStyles, Sakura, Steam, Washi, ui } from "../fun";
import { Mascot } from "../Mascot";
import { RecipeArt } from "../RecipeArt";
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
    <div className={`${ui.page} ${maru.className}`}>
      <FunStyles />
      <section className="mx-auto w-full max-w-3xl p-6">
        <Link href="/recipes" className={`text-sm ${ui.link}`}>← All recipes</Link>

        <div className={`cooky-pop relative mt-4 flex flex-wrap items-center gap-5 bg-white p-5 shadow-[4px_4px_0_0_#A8D8EA] ${ui.frame} ${ui.wobble}`}>
          <Washi className="-top-2 right-10" />
          <div className="relative">
            <Steam className="absolute -top-6 left-9" />
            <RecipeArt id={recipe.id} title={recipe.title} className="h-28 w-28 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`text-2xl sm:text-3xl ${ui.heading}`}>{recipe.title}</h1>
            <p className={`mt-1 text-sm ${ui.muted}`}>
              ⏱ {recipe.minutes} min · 🍽 serves {recipe.baseServings} · 🍳 {recipe.equipment.join(", ") || "no special equipment"}
            </p>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {recipe.tags.map((t) => (
                <span key={t} className={`rounded-full px-2 py-0.5 text-xs font-bold ${ui.tag}`}>#{t}</span>
              ))}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`/cook/${recipe.id}`} className={`px-5 py-2.5 text-sm ${ui.btn} ${ui.wobbleSm}`}>Let&apos;s cook! 👩‍🍳</Link>
          <Link href={`/plan?recipes=${recipe.id}`} className={`px-5 py-2.5 text-sm ${ui.btnGhost} ${ui.wobbleSm}`}>+ Add to my plan</Link>
          <span className="ml-auto flex items-center gap-2 text-xs">
            <Mascot mood="happy" size={40} className="cooky-float" />
            <span className={`rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 font-bold ${ui.frame}`}>Ask me anything while you cook!</span>
          </span>
        </div>

        <h2 className={`mt-9 flex items-center gap-2 text-lg ${ui.heading}`}>
          <Sakura size={20} /> Gather your ingredients <span className={`text-sm font-normal ${ui.muted}`}>for {recipe.baseServings} · tap to tick off</span>
        </h2>
        <PrepChecklist ingredients={recipe.ingredients} />

        <h2 className={`mt-9 flex items-center gap-2 text-lg ${ui.heading}`}>
          <Sakura size={20} /> Steps
        </h2>
        <ol className="mt-3 space-y-3 text-sm">
          {steps.map((s) => (
            <li key={s.id} className={`flex gap-3 bg-white p-4 ${ui.cardSoft} ${ui.wobbleSm}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#34374A] bg-[#A8D8EA] font-bold">{s.stepNo}</span>
              <div className="flex-1">
                <p className="leading-relaxed">{s.text}</p>
                {s.timerSeconds && <p className={`mt-1 text-xs font-bold text-[#4F6FA3]`}>⏱ timer {formatTimer(s.timerSeconds)}</p>}
                {tipFor.get(s.stepNo) && (
                  <p className="mt-2 rounded-xl bg-[#FFF0F3] px-2.5 py-1.5 text-xs">💡 {tipFor.get(s.stepNo)!.text}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {recipe.faqs.length > 0 && (
          <>
            <h2 className={`mt-9 flex items-center gap-2 text-lg ${ui.heading}`}>
              <Sakura size={20} /> Questions cooks ask
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recipe.faqs.map((f) => (
                <details key={f.id} className={`group bg-white px-4 py-2.5 text-sm ${ui.cardSoft} ${ui.wobbleSm}`}>
                  <summary className="cursor-pointer list-none font-bold">
                    <span className="mr-1 inline-block transition group-open:rotate-90">›</span>
                    {f.label.replace(/^FAQ:\s*/, "").replace(/^./, (c) => c.toUpperCase())}
                  </summary>
                  <p className={`mt-1.5 ${ui.muted}`}>{f.text}</p>
                </details>
              ))}
            </div>
          </>
        )}

        <p className={`mt-9 text-xs ${ui.muted}`}>
          Source: {recipe.sourceUrl ? <a href={recipe.sourceUrl} className={ui.link} rel="noopener noreferrer" target="_blank">{recipe.sourceLabel}</a> : recipe.sourceLabel}
        </p>
      </section>
    </div>
  );
}
