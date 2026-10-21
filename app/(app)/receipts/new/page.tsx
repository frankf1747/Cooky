// Owner: Receipts. Scan a receipt (RCT1): pick or take a photo, downsize it here, upload, review.
import targets from "@spec/targets.json";
import { ScanForm } from "./ScanForm";

export default async function ReceiptsNewPage(props: PageProps<"/receipts/new">) {
  const { planId } = await props.searchParams;
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Scan a receipt</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Take a photo of the whole receipt. Cooky reads it and shows you every line to check before anything goes in your fridge.
      </p>
      <ScanForm
        maxPx={targets.limits.receiptImageMaxPx}
        maxMb={targets.limits.receiptImageMaxMb}
        planId={typeof planId === "string" && /^pln_[0-9a-z_]+$/.test(planId) ? planId : null}
      />
    </section>
  );
}
