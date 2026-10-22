// Owner: Plan & Shop. One plan (PLN6, PLN8): the dinners in cooking order with their reasons and a
// swap, save, then the next two steps as big buttons (the shopping list with its count and
// price, and stocking the fridge from the receipt), and one floating Cook button that cooks the
// whole plan in sequence.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CookingPot } from "@phosphor-icons/react/ssr";
import type { PlanDraft } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import { formatUsd } from "@/platform/money";
import { getPlan, planNotes } from "@/modules/planning";
import { Kicker, Page, Section } from "@/ui/Page";
import { h3, panel, rows, tagGood, tones, warn, type Tone } from "@/ui/styles";
import { RecipeImage } from "../../recipes/RecipeImage";
import { formatQty } from "../ui";
import { SaveButton } from "./SaveButton";
import { SwapMeal } from "./SwapMeal";
import targets from "@spec/targets.json";

/** A next step as one big button: the step's colour, what it is, and what it costs. */
function StepButton({ href, tone, kicker, title, detail }: { href: string; tone: Tone; kicker: string; title: string; detail: React.ReactNode }) {
  return (
    <Link href={href} className={`group flex items-center gap-4 rounded-[24px] p-5 transition active:scale-[0.99] sm:p-6 ${tones[tone].tint}`}>
      <span className="min-w-0 flex-1">
        <Kicker tone={tone} className="!text-foreground/70">{kicker}</Kicker>
        <span className="mt-2 block font-display text-2xl font-semibold leading-tight sm:text-[1.75rem]">{title}</span>
        <span className="mt-1 block text-[15px] text-foreground/75">{detail}</span>
      </span>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface transition group-hover:translate-x-0.5">
        <ArrowRight size={20} weight="bold" aria-hidden />
      </span>
    </Link>
  );
}

export default async function PlanIdPage(props: PageProps<"/plan/[id]">) {
  const { id } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let plan: PlanDraft;
  try {
    plan = await getPlan(user.id, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const notes = await planNotes(user.id, plan);
  const over = plan.totalCents > plan.budgetCents;
  const unpriced = plan.shopping.unpricedIngredientIds.length;
  const toBuy = plan.shopping.items.filter((i) => i.packages > 0 || i.costCents === null);
  const titles = new Map(plan.meals.map((m) => [m.recipeId, m.title]));

  return (
    <Page
      back={{ href: "/plan", label: "All plans" }}
      kicker="Step 1 · Plan"
      tone="plan"
      title={`${plan.meals.length} dinners for ${plan.servings}`}
      description={plan.status === "saved" ? "Saved: this is your plan for the week. Cook the dinners in order with the Cook button." : "Swap anything you don't fancy, then save the plan to keep it."}
      actions={plan.status === "saved" ? (
        <div><span className={`${tagGood} !px-3 !py-1.5 !text-sm`}>Saved for this week</span></div>
      ) : (
        <SaveButton planId={plan.planId} version={plan.version} />
      )}
    >
      <ol className="grid gap-3">
        {plan.meals.map((m, i) => (
          <li key={i} className={`${panel} p-4 sm:p-5`}>
            <article>
              <div className="flex items-start gap-4">
                <Link href={`/recipes/${m.recipeId}`} className="shrink-0" tabIndex={-1} aria-hidden>
                  <RecipeImage id={m.recipeId} imageUrl={null} title={m.title} shape="soft" className="h-20 w-24 sm:h-24 sm:w-32" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-muted">Dinner {i + 1}</p>
                  <h2 className={`${h3} mt-1`}>
                    <Link href={`/recipes/${m.recipeId}`} className="underline-offset-4 hover:underline">{m.title}</Link>
                  </h2>
                  {m.usesFridgeItemIds.length > 0 && (
                    <p className={`mt-2 ${tagGood}`}>Uses {m.usesFridgeItemIds.length} from your fridge</p>
                  )}
                </div>
              </div>
              {m.reasons.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-[15px] leading-snug text-muted">
                  {m.reasons.map((r, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {notes.pastUseBy.filter((p) => p.recipeIds.includes(m.recipeId)).map((p) => (
                <p key={p.itemId} role="note" className={`mt-3 ${warn}`}>
                  Uses your {p.name}, which is past its typical use-by date ({p.expiresOn}). Check it before cooking; dates are a typical guide, not safety advice.
                </p>
              ))}
              <SwapMeal planId={plan.planId} version={plan.version} mealIndex={i} title={m.title} maxChars={targets.limits.feedbackMaxChars} />
            </article>
          </li>
        ))}
      </ol>

      <Section title="Next" className="scroll-mt-24">
        <div id="shopping" className="grid gap-3">
          <StepButton
            href={`/shop/${plan.planId}`}
            tone="shop"
            kicker="Step 2 · Shop"
            title="Shopping list"
            detail={toBuy.length === 0
              ? "Nothing to buy: your fridge and staples cover every meal."
              : <>{toBuy.length} item{toBuy.length === 1 ? "" : "s"} · about <span className="font-semibold tabular-nums">{formatUsd(plan.totalCents)}</span>{plan.budgetCents > 0 && <> of your {formatUsd(plan.budgetCents)}{over && ", over budget"}</>}{unpriced > 0 && ", some prices unknown"}</>}
          />
          <StepButton
            href={`/receipts/new?planId=${plan.planId}`}
            tone="scan"
            kicker="Step 3 · Stock"
            title="Stock the fridge"
            detail="Back from the store? Scan the receipt: prices get logged and the food goes in."
          />
        </div>
      </Section>

      {notes.extras.items.length > 0 && (
        <Section
          className="!mt-12"
          title="Optional extras"
          note={<>Not in the total{notes.extras.totalCents > 0 && ` · +${formatUsd(notes.extras.totalCents)} if you add them all`}{notes.extras.unpricedIngredientIds.length > 0 && " (some prices unknown)"}</>}
        >
          <ul className={`${rows} text-[15px]`}>
            {notes.extras.items.map((i) => (
              <li key={`${i.ingredientId}|${i.unit}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="min-w-0">
                  <span className="font-medium">{i.name}</span>
                  <span className="block text-sm text-muted">{formatQty(i.needQty, i.unit)} for {i.forRecipeIds.map((r) => titles.get(r) ?? r).join(", ")}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-sm text-muted tabular-nums">
                  {i.buyQty === 0 ? "already covered" : i.packageSize !== null ? `${i.packages} × ${formatQty(i.packageSize, i.unit)} · ${formatUsd(i.costCents)}` : formatUsd(i.costCents)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.assumptions.length > 0 && (
        <div className="mt-10 border-t border-line pt-5 text-sm text-muted">
          <p className="font-medium text-foreground">Assumptions</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
      {/* one Cook button for the whole plan, in order, floating where the thumb is */}
      {plan.meals.length > 0 && (
        <Link
          href={`/cook/${plan.meals[0].recipeId}?plan=${plan.planId}&n=0`}
          className="pop-in fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 items-center gap-2.5 rounded-full bg-foreground pl-4 pr-6 text-[15px] font-semibold text-background shadow-float transition hover:scale-[1.02] active:scale-[0.97] sm:bottom-8 sm:right-8"
        >
          <CookingPot size={22} weight="fill" aria-hidden />
          Cook {plan.meals.length === 1 ? "it" : `all ${plan.meals.length}`}
        </Link>
      )}
    </Page>
  );
}
