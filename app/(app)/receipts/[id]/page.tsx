// Owner: Receipts. Review one receipt (RCT2–RCT7, RCT10): check flagged lines, then add to the fridge;
// with a linked plan, what the plan wanted but the receipt lacks, and the reverse (RCT5).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Category, type ReceiptDraft } from "@spec/contract";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import { getForReview, type PlanLabels, type ReviewShelf } from "@/modules/receipts";
import { PlanDiffPanel } from "./PlanDiffPanel";
import { ReviewForm } from "./ReviewForm";
import { Page } from "@/ui/Page";
import { alert, btnPrimary, btnText, note } from "@/ui/styles";

export default async function ReceiptsIdPage(props: PageProps<"/receipts/[id]">) {
  const { id } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let receipt: ReceiptDraft;
  let plan: PlanLabels | null;
  let shelf: ReviewShelf;
  try {
    ({ receipt, plan, shelf } = await getForReview(user.id, id));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const heading = [receipt.store, receipt.purchasedOn].filter(Boolean).join(" · ") || "Your receipt";

  return (
    <Page
      back={{ href: "/receipts/new", label: "Scan another receipt" }}
      kicker="Step 3 · Stock"
      tone="scan"
      title={heading}
      description={receipt.status === "parsed" ? "Check the lines, then add them to your fridge; nothing changes until you do." : undefined}
    >

      {receipt.planDiff && plan && <PlanDiffPanel diff={receipt.planDiff} plan={plan} lines={receipt.lines} />}

      {receipt.status === "parsed" && (
        <ReviewForm receiptId={receipt.receiptId} lines={receipt.lines} categories={Category.options} shelf={shelf} />
      )}

      {receipt.status === "failed" && (
        <div role="alert" className={`mt-6 ${alert} !p-5`}>
          <p className="text-[15px]">
            Cooky couldn&apos;t read this receipt. Nothing was added to your fridge, and Cooky doesn&apos;t keep receipt photos, so scan it again to retry.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Link href="/receipts/new" className={btnPrimary}>Scan again</Link>
            <Link href="/fridge" className={btnText}>Add groceries by hand</Link>
          </div>
        </div>
      )}

      {receipt.status === "parsing" && (
        <p className={`mt-6 ${note} text-[15px]`} aria-live="polite">
          Cooky is still reading this receipt. <Link href={`/receipts/${receipt.receiptId}`} className={btnText}>Refresh</Link> in a moment.
        </p>
      )}

      {receipt.status === "confirmed" && (
        <p className={`mt-6 ${note} text-[15px]`}>
          These items are already in your fridge. <Link href="/fridge" className={btnText}>Open the fridge</Link>
        </p>
      )}
    </Page>
  );
}
