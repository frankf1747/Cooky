// Owner: Platform. Journey step 2: unlock Pro with a Stripe test payment (SPEC ACC5–ACC8).
import targets from "@spec/targets.json";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { entitlement } from "@/modules/billing";
import { BillingClient } from "./BillingClient";
import { Page } from "@/ui/Page";

export default async function BillingPage(props: PageProps<"/billing">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { status } = await props.searchParams;
  const initial = await entitlement(user.id);
  return (
    <Page title="Cooky Pro" description="AI help for planning, receipts and cooking. One payment, test mode only." width="narrow">
      <BillingClient
        initial={initial}
        status={status === "success" || status === "cancelled" ? status : null}
        priceCents={Math.round(targets.costModel.proPriceUsd * 100)}
        poll={{ intervalMs: targets.limits.entitlementPollIntervalMs, maxMs: targets.limits.entitlementPollMaxMs }}
      />
    </Page>
  );
}
