// Owner: Recipes & Cook. One recipe (RCP3): the dish first, the facts that decide whether you
// cook it tonight (time, servings, equipment), one clear way to start, then a prep checklist
// beside the method with its timers and tips, the questions cooks ask, and the source.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaretDown, Clock, CookingPot, Timer, UsersThree } from "@phosphor-icons/react/ssr";
import type { Recipe } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import * as recipes from "@/modules/recipes";
import { BackLink, Kicker } from "@/ui/Page";
import { PlanPickButton } from "@/ui/PlanPick";
import { btnPrimary, btnText, h1, h2, rows } from "@/ui/styles";
import { RecipeImage } from "../RecipeImage";
import { formatTimer } from "../ui";
import { PrepChecklist } from "./PrepChecklist";

const TAG_LABEL: Record<string, string> = { "one-pan": "One pan", "high-protein": "High protein", "uses-leftovers": "Uses leftovers" };
const tagLabel = (t: string) => TAG_LABEL[t] ?? (t.charAt(0).toUpperCase() + t.slice(1)).replaceAll("-", " ");

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
  const kicker = recipe.tags.filter((t) => t !== "dinner").slice(0, 3).map(tagLabel).join(" · ");

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8">
      <BackLink href="/recipes" label="All recipes" />

      <header className="mt-3 grid items-center gap-7 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-14">
        <RecipeImage id={recipe.id} imageUrl={recipe.imageUrl} title={recipe.title} decorative={false} className="rise-in aspect-[4/3] w-full" />
        <div>
          {kicker && <Kicker tone="cook">{kicker}</Kicker>}
          <h1 className={`${h1} mt-3`}>{recipe.title}</h1>
          <dl className="mt-6 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface">
            <div className="px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted"><Clock size={14} aria-hidden /> Time</dt>
              <dd className="mt-1 font-display text-xl font-semibold">{recipe.minutes} min</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted"><UsersThree size={14} aria-hidden /> Serves</dt>
              <dd className="mt-1 font-display text-xl font-semibold">{recipe.baseServings}</dd>
            </div>
            <div className="min-w-0 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted"><CookingPot size={14} aria-hidden /> You need</dt>
              <dd className="mt-1 truncate text-[15px] font-medium leading-7" title={recipe.equipment.join(", ")}>{recipe.equipment.join(", ") || "Nothing special"}</dd>
            </div>
          </dl>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <Link href={`/cook/${recipe.id}`} className={btnPrimary}>Start cooking</Link>
            <PlanPickButton dish={{ id: recipe.id, title: recipe.title }} variant="full" />
          </div>
        </div>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.25fr)] lg:gap-16">
        <section aria-labelledby="ingredients-title" className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="ingredients-title" className={h2}>
            Ingredients <span className="font-sans text-sm font-normal tracking-normal text-muted">for {recipe.baseServings}</span>
          </h2>
          <PrepChecklist ingredients={recipe.ingredients} />
        </section>

        <section aria-labelledby="method-title">
          <h2 id="method-title" className={h2}>Method</h2>
          {steps.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted">This recipe has no steps yet.</p>
          ) : (
            <ol className="mt-4 divide-y divide-line border-y border-line">
              {steps.map((s) => (
                <li key={s.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 py-5 sm:grid-cols-[3rem_minmax(0,1fr)]">
                  <span aria-hidden className="font-display text-[1.75rem] font-semibold leading-none text-basil">{s.stepNo}</span>
                  <div>
                    <span className="sr-only">Step {s.stepNo}. </span>
                    <p className="text-[16px] leading-relaxed sm:text-[17px]">{s.text}</p>
                    {s.timerSeconds && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-medium tabular-nums">
                        <Timer size={14} aria-hidden /> Timer {formatTimer(s.timerSeconds)}
                      </p>
                    )}
                    {tipFor.get(s.stepNo) && (
                      <p className="mt-3 rounded-xl bg-sunken/80 px-3.5 py-2.5 text-sm leading-relaxed">
                        <span className="font-semibold">Tip. </span>{tipFor.get(s.stepNo)!.text}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {recipe.faqs.length > 0 && (
            <section aria-labelledby="faq-title" className="mt-12">
              <h2 id="faq-title" className={h2}>Questions cooks ask</h2>
              <div className={`mt-4 ${rows}`}>
                {recipe.faqs.map((f) => (
                  <details key={f.id} className="group px-4 py-1 text-[15px]">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                      {f.label.replace(/^FAQ:\s*/, "").replace(/^./, (c) => c.toUpperCase())}
                      <CaretDown size={16} aria-hidden className="shrink-0 text-muted transition group-open:rotate-180" />
                    </summary>
                    <p className="pb-3 leading-relaxed text-muted">{f.text}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <p className="mt-10 text-sm text-muted">
            Source: {recipe.sourceUrl ? <a href={recipe.sourceUrl} className={btnText} rel="noopener noreferrer" target="_blank">{recipe.sourceLabel}</a> : recipe.sourceLabel}
          </p>
        </section>
      </div>
    </section>
  );
}
