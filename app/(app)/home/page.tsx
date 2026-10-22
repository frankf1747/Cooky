// Owner: Platform. Home: the week at a glance and the one next thing to do, in journey order
// (plan, shop, scan, cook). Reads only; every action happens on its own page.
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/platform/auth";
import { localToday } from "@/platform/dates";
import { formatUsd } from "@/platform/money";
import * as account from "@/modules/account";
import * as fridge from "@/modules/fridge";
import * as planning from "@/modules/planning";
import { Page } from "@/ui/Page";
import { btnPrimary, btnSecondary } from "@/ui/styles";

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function freshnessLabel(days: number): string {
  if (days < 0) return "past its typical use-by";
  if (days === 0) return "use today";
  if (days === 1) return "use by tomorrow";
  return `use within ${days} days`;
}

type StepState = "done" | "next" | "later";

function Step({ n, title, state, children, action }: { n: number; title: string; state: StepState; children: ReactNode; action?: ReactNode }) {
  return (
    <li className={`flex gap-4 rounded-lg border p-4 sm:p-5 ${state === "next" ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-800"}`}>
      <span
        aria-hidden
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${state === "done" ? "bg-emerald-700 text-white" : state === "next" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"}`}
      >
        {state === "done" ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7.5 6 10.5 11 4" /></svg>
        ) : (
          n
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-semibold">
            {title}
            {state === "done" && <span className="sr-only"> (done)</span>}
          </h2>
        </div>
        <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
    </li>
  );
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [me, plans, view, today] = await Promise.all([
    account.me(user.id, user.email),
    planning.listPlans(user.id),
    fridge.view(user.id),
    localToday(user.id),
  ]);
  if (!me.onboarded) redirect("/onboarding");

  const saved = plans.items.find((p) => p.status === "saved") ?? null;
  const latest = plans.items[0] ?? null;
  const plan = saved ? await planning.getPlan(user.id, saved.planId) : null;
  const toBuy = plan ? plan.shopping.items.filter((i) => i.buyQty > 0) : [];

  const expiring = view.items
    .filter((i) => view.expiringSoon.includes(i.id) && i.expiresOn)
    .map((i) => ({ ...i, days: daysBetween(today, i.expiresOn!) }))
    .sort((a, b) => a.days - b.days);
  const cookNow = view.cookNow.slice(0, 3);

  const stocked = view.items.length > 0;
  // Every unfinished step that can be done now is "next", but only the first one is highlighted.
  const raw: StepState[] = [saved ? "done" : "next", saved ? "next" : "later", stocked ? "done" : saved ? "next" : "later", stocked ? "next" : "later"];
  const first = raw.indexOf("next");
  const [planState, shopState, scanState, cookState] = raw.map((st, i) => (st === "next" && i !== first ? "later" : st));
  const primaryIf = (st: StepState) => (st === "next" ? btnPrimary : btnSecondary);

  return (
    <Page
      title="This week"
      description="Plan dinners from what you have, buy only what's missing, then cook before anything goes off."
      width="wide"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="space-y-3">
          <Step n={1} title="Plan your dinners" state={planState}
            action={saved
              ? <><Link className={btnSecondary} href={`/plan/${saved.planId}`}>Open this week&apos;s plan</Link><Link className={btnSecondary} href="/plan">Make a new plan</Link></>
              : <Link className={btnPrimary} href="/plan">{latest ? "Finish planning" : "Plan dinners"}</Link>}
          >
            {saved
              ? <>Saved: {saved.mealTitles.join(", ")}. {formatUsd(saved.totalCents)} to shop.</>
              : latest
                ? <>You have a draft plan ({latest.mealTitles.join(", ")}). Save it to get your shopping list.</>
                : <>Pick how many dinners, your budget and time. Cooky starts from your fridge.</>}
          </Step>

          <Step n={2} title="Shop the list" state={shopState}
            action={saved && <Link className={primaryIf(shopState)} href={`/plan/${saved.planId}#shopping`}>View shopping list</Link>}
          >
            {saved
              ? toBuy.length
                ? <>{toBuy.length} item{toBuy.length === 1 ? "" : "s"} to buy, about {formatUsd(plan!.shopping.totalCents)}, in real package sizes.</>
                : <>Your fridge already covers this plan. Nothing to buy.</>
              : <>Your list appears here once you save a plan.</>}
          </Step>

          <Step n={3} title="Scan your receipt" state={scanState}
            action={<Link className={primaryIf(scanState)} href={saved ? `/receipts/new?planId=${saved.planId}` : "/receipts/new"}>Scan a receipt</Link>}
          >
            After shopping, take a photo of the receipt. You check every line before anything goes in your fridge.
          </Step>

          <Step n={4} title="Cook from your fridge" state={cookState}
            action={stocked && <Link className={primaryIf(cookState)} href="/recipes?chips=fridge">See what you can cook</Link>}
          >
            {stocked
              ? cookNow.length
                ? <>Best matches now: {cookNow.map((c) => c.title).join(", ")}.</>
                : <>Nothing matches your fridge yet. Browse recipes to find something close.</>
              : <>Once your fridge has food, Cooky suggests dishes that use it up.</>}
          </Step>
        </ol>

        <aside className="space-y-6">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">Use soon</h2>
              <Link href="/fridge" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">Fridge</Link>
            </div>
            {expiring.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{stocked ? "Nothing is close to its typical use-by date." : "Your fridge is empty."}</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                {expiring.slice(0, 6).map((i) => (
                  <li key={i.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{i.name}</span>
                    <span className={`shrink-0 text-xs ${i.days < 0 ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}`}>{freshnessLabel(i.days)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-zinc-500">Dates are a typical storage guide, not a safety check.</p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <h2 className="font-semibold">Your plan</h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {me.plan === "pro" ? "Cooky Pro: AI plans, receipt scanning and cooking help are on." : "Free: one AI plan, the recipe library and your fridge."}
            </p>
            <Link href={me.plan === "pro" ? "/settings" : "/billing"} className="mt-2 inline-block font-medium hover:underline">
              {me.plan === "pro" ? "Settings" : "Unlock Pro"}
            </Link>
          </div>
        </aside>
      </div>
    </Page>
  );
}
