// Owner: Platform. Home: Bao's one-line read of the week, then the journey as four colour tiles
// (plan, shop, scan, cook) with the next thing to do lit up. Reads only; every action happens on
// its own page.
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/ssr";
import { getSessionUser } from "@/platform/auth";
import { localToday } from "@/platform/dates";
import { formatUsd } from "@/platform/money";
import * as account from "@/modules/account";
import * as fridge from "@/modules/fridge";
import * as planning from "@/modules/planning";
import { Bao, BaoSays, type BaoMood, type BaoProp } from "@/ui/Bao";
import { Page } from "@/ui/Page";
import { btnPrimary, btnSecondary, btnText, panel, tag, tiles, type Tile } from "@/ui/styles";

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

function Step({ n, tile, title, state, children, action }: { n: number; tile: Tile; title: string; state: StepState; children: ReactNode; action?: ReactNode }) {
  return (
    <li className={`relative rounded-2xl p-4 sm:p-5 ${tiles[tile]} ${state === "next" ? "ring-2 ring-foreground" : ""} ${state === "later" ? "opacity-80" : ""}`}>
      <div className="flex items-start gap-4">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface font-display text-lg font-bold">
          {state === "done" ? <Check size={20} weight="bold" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
            {state === "next" && <span className={tag}>Up next</span>}
            {state === "done" && <span className="sr-only">(done)</span>}
          </div>
          <div className="mt-1 text-[15px] leading-snug">{children}</div>
          {action && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{action}</div>}
        </div>
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

  // Bao's one line. The most useful thing first: food on a clock, then the next step.
  const urgent = expiring[0];
  let greeting: { mood: BaoMood; prop: BaoProp; text: string };
  if (urgent && urgent.days <= 2) {
    const name = urgent.name.toLowerCase();
    greeting = {
      mood: "worried",
      prop: "spoon",
      text: urgent.days < 0
        ? `The ${name} is past its typical date. Give it a look before anything else.`
        : urgent.days === 0
          ? `The ${name} wants cooking today. Not tomorrow. Today.`
          : `The ${name} has about ${urgent.days} day${urgent.days === 1 ? "" : "s"} left. Let's put it to work first.`,
    };
  } else if (!saved) {
    greeting = { mood: "happy", prop: "spoon", text: latest ? "You have a draft plan waiting. Save it and I'll write the shopping list." : "No plan yet. Tell me how many dinners and I'll build the week around your fridge." };
  } else if (toBuy.length > 0 && !stocked) {
    greeting = { mood: "happy", prop: "basket", text: `${toBuy.length} thing${toBuy.length === 1 ? "" : "s"} to buy, about ${formatUsd(plan!.shopping.totalCents)}. Real package sizes, so no half-bags of spinach.` };
  } else if (stocked && cookNow.length > 0) {
    greeting = { mood: "cheer", prop: "spoon", text: `You could make ${cookNow[0].title.toLowerCase()} right now. I checked the fridge twice.` };
  } else {
    greeting = { mood: "proud", prop: "basket", text: "Fridge stocked, plan saved. This is the good part." };
  }

  return (
    <Page title="This week" description="Plan, shop, scan, cook. Bao keeps score.">
      <BaoSays mood={greeting.mood} pose="hold" prop={greeting.prop} motion="bob" className="rise-in">{greeting.text}</BaoSays>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="space-y-3">
          <Step n={1} tile="sky" title="Plan your dinners" state={planState}
            action={saved
              ? <><Link className={btnSecondary} href={`/plan/${saved.planId}`}>Open this week&apos;s plan</Link><Link className={`text-sm ${btnText}`} href="/plan">Make a new plan</Link></>
              : <Link className={btnPrimary} href="/plan">{latest ? "Finish planning" : "Plan dinners"}</Link>}
          >
            {saved
              ? <>Saved: {saved.mealTitles.join(", ")}. {formatUsd(saved.totalCents)} to shop.</>
              : latest
                ? <>A draft is waiting ({latest.mealTitles.join(", ")}). Save it to get the shopping list.</>
                : <>How many dinners, what budget, how much time. Cooky starts from your fridge.</>}
          </Step>

          <Step n={2} tile="butter" title="Shop the list" state={shopState}
            action={saved && <Link className={primaryIf(shopState)} href={`/shop/${saved.planId}`}>Open the list</Link>}
          >
            {saved
              ? toBuy.length
                ? <>{toBuy.length} item{toBuy.length === 1 ? "" : "s"}, about {formatUsd(plan!.shopping.totalCents)}, in the sizes the shop actually sells.</>
                : <>Your fridge already covers this plan. Nothing to buy. Rare.</>
              : <>Your list appears here once a plan is saved.</>}
          </Step>

          <Step n={3} tile="tangerine" title="Scan the receipt" state={scanState}
            action={<Link className={primaryIf(scanState)} href={saved ? `/receipts/new?planId=${saved.planId}` : "/receipts/new"}>Scan a receipt</Link>}
          >
            Back from the shop? One photo of the receipt and Bao reads it into your fridge. You check every line first.
          </Step>

          <Step n={4} tile="mint" title="Cook from your fridge" state={cookState}
            action={stocked && <Link className={primaryIf(cookState)} href="/recipes?chips=fridge">See what you can cook</Link>}
          >
            {stocked
              ? cookNow.length
                ? <>Best matches right now: {cookNow.map((c) => c.title).join(", ")}.</>
                : <>Nothing matches the fridge yet. Browse the recipes for something close.</>
              : <>Once the fridge has food in it, Bao suggests dishes that use it up.</>}
          </Step>
        </ol>

        <aside className="space-y-4">
          <div className={`rounded-2xl p-4 ${tiles.sakura}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-semibold tracking-tight">Use soon</h2>
              <Link href="/fridge" className={`text-sm ${btnText}`}>Fridge</Link>
            </div>
            {expiring.length === 0 ? (
              <div className="mt-3 flex items-center gap-3">
                <Bao mood="sleepy" size={44} decorative />
                <p className="text-sm">{stocked ? "Nothing is close to its date. Bao is napping." : "The fridge is empty, so there is nothing to rush."}</p>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-foreground/10 text-sm">
                {expiring.slice(0, 6).map((i) => (
                  <li key={i.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 truncate font-medium">{i.name}</span>
                    <span className={`shrink-0 text-xs ${i.days < 0 ? "font-medium text-amber-800 dark:text-amber-300" : ""}`}>{freshnessLabel(i.days)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">Dates are a typical storage guide, not a safety check.</p>
          </div>

          <div className={`p-4 text-sm ${panel}`}>
            <h2 className="font-display text-lg font-semibold tracking-tight">Your plan</h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {me.plan === "pro" ? "Cooky Pro: AI plans, receipt scanning and Bao in the kitchen are on." : "Free: one AI plan, the recipe library and your fridge."}
            </p>
            <Link href={me.plan === "pro" ? "/settings" : "/billing"} className={`mt-2 inline-block ${btnText}`}>
              {me.plan === "pro" ? "Settings" : "Unlock Pro"}
            </Link>
          </div>
        </aside>
      </div>
    </Page>
  );
}
