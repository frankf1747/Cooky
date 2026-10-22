// Owner: Plan & Shop. Plan meals (PLN1–PLN6): the request form and recent plans.
import Link from "next/link";
import { redirect } from "next/navigation";
import targets from "@spec/targets.json";
import { getSessionUser } from "@/platform/auth";
import { formatUsd } from "@/platform/money";
import { planFormData } from "@/modules/planning";
import { Page } from "@/ui/Page";
import { btnSecondary } from "@/ui/styles";
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

  return (
    <Page
      title="Plan dinners"
      description="Cooky picks dinners around your fridge, budget and time, then gives you one shopping list in real package sizes."
      width="narrow"
      actions={<Link href="/preferences" className={btnSecondary}>Your preferences</Link>}
    >

      <PlanForm
        data={data}
        preselected={preselected}
        limits={{ servingsMin: L.servingsMin, servingsMax: L.servingsMax, mealsMin: L.mealsPerPlanMin, mealsMax: L.mealsPerPlanMax, wishesMaxChars: L.wishesMaxChars }}
      />

      <h2 className="mt-12 text-lg font-semibold">Recent plans</h2>
      {data.recentPlans.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No plans yet. Your first one will show up here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {data.recentPlans.map((p) => (
            <li key={p.planId}>
              <Link href={`/plan/${p.planId}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <span>
                  {p.mealTitles.join(" · ")}
                  <span className="ml-2 text-zinc-500">{new Date(p.createdAt).toLocaleDateString()}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "saved" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                    {p.status}
                  </span>
                  {formatUsd(p.totalCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
