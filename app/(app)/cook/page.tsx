// Owner: Recipes & Cook. The Cook tab: this week's plan in cooking order with one way to start it
// (cook mode then walks through every dinner in turn), and anything the fridge can make right now.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { getSessionUser } from "@/platform/auth";
import * as fridge from "@/modules/fridge";
import { getPlan, listPlans } from "@/modules/planning";
import { DishArt } from "@/ui/DishArt";
import { EmptyState, Page, Section } from "@/ui/Page";
import { btnPrimary, btnSecondary, h3, rows } from "@/ui/styles";

export default async function CookTab() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [plans, view] = await Promise.all([listPlans(user.id), fridge.view(user.id)]);
  const summary = plans.items.find((p) => p.status === "saved") ?? plans.items[0] ?? null;
  const plan = summary ? await getPlan(user.id, summary.planId) : null;
  const dishes = plan?.meals ?? [];
  const ready = view.cookNow.filter((c) => c.coverage >= 1).slice(0, 6);
  const start = plan && dishes.length ? `/cook/${dishes[0].recipeId}?plan=${plan.planId}&n=0` : null;

  return (
    <Page
      kicker="Step 4 · Cook"
      tone="cook"
      title={start ? "Cook your plan" : "What to cook"}
      description={start ? "One dinner after another, in order. Bao walks you through each one." : undefined}
      actions={start ? <Link href={start} className={btnPrimary}>Start cooking</Link> : undefined}
    >
      {start && plan ? (
        <ol className={rows}>
          {dishes.map((d, i) => (
            <li key={`${d.recipeId}-${i}`}>
              <Link href={`/cook/${d.recipeId}?plan=${plan.planId}&n=${i}`} className="group flex min-h-20 items-center gap-4 px-4 py-3 transition hover:bg-sunken/50">
                <span className="w-6 shrink-0 font-display text-2xl font-semibold text-basil">{i + 1}</span>
                <DishArt id={d.recipeId} title={d.title} frame="plate" className="h-14 w-14 shrink-0 rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${h3}`}>{d.title}</span>
                  <span className="text-sm text-muted">{plan.status === "saved" ? "From this week's plan" : "From your draft plan"}</span>
                </span>
                <ArrowRight size={18} aria-hidden className="shrink-0 text-subtle transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Nothing planned yet"
          mood="thinking"
          pose="think"
          action={<><Link href="/plan" className={btnPrimary}>Plan dinners</Link><Link href="/fridge" className={btnSecondary}>Open the fridge</Link></>}
        >
          Plan a few dinners and they line up here, ready to cook one after another.
        </EmptyState>
      )}

      {ready.length > 0 && (
        <Section title="Ready from your fridge" note="Everything these need is already in the fridge.">
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-6">
            {ready.map((r) => (
              <li key={r.recipeId}>
                <Link href={`/cook/${r.recipeId}`} className="group flex flex-col items-center text-center">
                  <DishArt id={r.recipeId} title={r.title} frame="plate" className="aspect-square w-full max-w-[6.5rem] rounded-full transition duration-300 group-hover:-translate-y-0.5" />
                  <span className="mt-2 line-clamp-2 text-[13px] font-medium leading-tight">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
