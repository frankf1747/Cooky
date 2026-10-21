// Owner: Receipts. Scan a receipt (RCT1): pick or take a photo, downsize it here, upload, review.
// Optionally compare it with one of the user's plans (RCT5).
import { redirect } from "next/navigation";
import targets from "@spec/targets.json";
import { getSessionUser } from "@/platform/auth";
import { listPlans } from "@/modules/planning";
import { ScanForm } from "./ScanForm";

export default async function ReceiptsNewPage(props: PageProps<"/receipts/new">) {
  const { planId } = await props.searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { items } = await listPlans(user.id);
  const plans = items.map((p) => ({
    planId: p.planId,
    label: `${p.mealTitles.slice(0, 3).join(", ") || "Plan"}${p.mealTitles.length > 3 ? "…" : ""} · ${p.createdAt.slice(0, 10)}${p.status === "saved" ? "" : " (draft)"}`,
    saved: p.status === "saved",
  }));
  const asked = typeof planId === "string" ? plans.find((p) => p.planId === planId) : undefined;
  // Most likely the list they shopped from: the plan they came from, else their newest saved plan.
  const initial = asked?.planId ?? plans.find((p) => p.saved)?.planId ?? null;

  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Scan a receipt</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Take a photo of the whole receipt. Cooky reads it, shows you every line to check before anything goes in your fridge, and doesn&apos;t keep the photo.
      </p>
      <ScanForm
        maxPx={targets.limits.receiptImageMaxPx}
        maxMb={targets.limits.receiptImageMaxMb}
        plans={plans.map(({ planId, label }) => ({ planId, label }))}
        initialPlanId={initial}
      />
    </section>
  );
}
