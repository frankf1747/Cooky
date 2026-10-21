// Owner: Receipts. Review one receipt (RCT2–RCT7, RCT10): check flagged lines, then add to the fridge;
// with a linked plan, what the plan wanted but the receipt lacks, and the reverse (RCT5).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Category, type ReceiptDraft } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import { getForReview, type PlanLabels } from "@/modules/receipts";
import { PlanDiffPanel } from "./PlanDiffPanel";
import { ReviewForm } from "./ReviewForm";

export default async function ReceiptsIdPage(props: PageProps<"/receipts/[id]">) {
  const { id } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let receipt: ReceiptDraft;
  let plan: PlanLabels | null;
  try {
    ({ receipt, plan } = await getForReview(user.id, id));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const heading = [receipt.store, receipt.purchasedOn].filter(Boolean).join(" · ") || "Your receipt";

  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <Link href="/receipts/new" className="text-sm text-zinc-500 hover:underline">← Scan another receipt</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{heading}</h1>

      {receipt.planDiff && plan && <PlanDiffPanel diff={receipt.planDiff} plan={plan} lines={receipt.lines} />}

      {receipt.status === "parsed" && (
        <ReviewForm receiptId={receipt.receiptId} lines={receipt.lines} categories={Category.options} />
      )}

      {receipt.status === "failed" && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-red-800 dark:text-red-200">
            Cooky couldn&apos;t read this receipt. Nothing was added to your fridge, and Cooky doesn&apos;t keep receipt photos, so scan it again to retry.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Link href="/receipts/new" className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">Scan again</Link>
            <Link href="/fridge" className="text-sm font-medium underline">Add groceries by hand</Link>
          </div>
        </div>
      )}

      {receipt.status === "parsing" && (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400" aria-live="polite">
          Cooky is still reading this receipt. <Link href={`/receipts/${receipt.receiptId}`} className="underline">Refresh</Link> in a moment.
        </p>
      )}

      {receipt.status === "confirmed" && (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          These items are already in your fridge. <Link href="/fridge" className="font-medium underline">Open the fridge</Link>
        </p>
      )}
    </section>
  );
}
