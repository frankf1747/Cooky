// Owner: Plan & Shop. Plan meals (PLN1–PLN6): this week's saved plan if there is one, the request
// form (dishes come from the fridge and the recipe library), and recent plans.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CaretRight } from "@phosphor-icons/react/ssr";
import targets from "@spec/targets.json";
import { getSessionUser } from "@/platform/auth";
import { formatUsd } from "@/platform/money";
import { planFormData } from "@/modules/planning";
import { Page, Section } from "@/ui/Page";
import { btnText, rows, tagGood, tagNeutral, tones } from "@/ui/styles";
import { PlanForm } from "./PlanForm";

export default async function PlanPage(props: PageProps<"/plan">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await planFormData(user.id);
  const L = targets.limits;
  // The library can link here as /plan?recipes=rcp_a,rcp_b; unknown ids are ignored.
  const param = (await props.searchParams).recipes;
  const preselected = (Array.isArray(param) ? param.join(",") : (param ?? ""))
    .split(",").filter((id) => data.recipes.some((r) => r.id === id)).slice(0, L.mealsPerPlanMax);

  const current = data.recentPlans.find((p) => p.status === "saved");

  return (
    <Page
      kicker="Step 1 · Plan"
      tone="plan"
      title="Plan dishes"
      description={<>Bao picks dishes around your fridge, budget and time, then writes one shopping list. <Link href="/preferences" className={btnText}>Your preferences</Link></>}
      width="narrow"
    >
      {current && (
        <Link href={`/plan/${current.planId}`} className={`group mb-10 flex items-center gap-4 rounded-[24px] p-5 transition active:scale-[0.99] ${tones.plan.tint}`}>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-cobalt-ink">This week&apos;s plan</span>
            <span className="mt-1 block truncate font-display text-xl font-semibold">{current.mealTitles.join(" · ")}</span>
            <span className="mt-0.5 block text-sm text-muted">Saved · {formatUsd(current.totalCents)} to shop</span>
          </span>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface transition group-hover:translate-x-0.5">
            <ArrowRight size={18} weight="bold" aria-hidden />
          </span>
        </Link>
      )}
      <PlanForm
        data={data}
        preselected={preselected}
        limits={{ servingsMin: L.servingsMin, servingsMax: L.servingsMax, mealsMin: L.mealsPerPlanMin, mealsMax: L.mealsPerPlanMax, wishesMaxChars: L.wishesMaxChars }}
      />

      <Section title="Recent plans">
        {data.recentPlans.length === 0 ? (
          <p className="rounded-2xl bg-sunken/60 px-4 py-5 text-[15px] text-muted">No plans yet. Your first one will show up here.</p>
        ) : (
          <ul className={rows}>
            {data.recentPlans.map((p) => (
              <li key={p.planId}>
                <Link href={`/plan/${p.planId}`} className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition hover:bg-sunken/50">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{p.mealTitles.join(" · ")}</span>
                    <span className="mt-0.5 block text-sm text-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={p.status === "saved" ? tagGood : tagNeutral}>{p.status === "saved" ? "Saved" : "Draft"}</span>
                    <span className="text-[15px] font-medium tabular-nums">{formatUsd(p.totalCents)}</span>
                    <CaretRight size={16} aria-hidden className="text-subtle" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}
