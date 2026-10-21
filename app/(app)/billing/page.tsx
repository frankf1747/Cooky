// Owner: Platform. Journey step 2: unlock Pro with a Stripe test payment (SPEC ACC5–ACC8).
import targets from "@spec/targets.json";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { entitlement } from "@/modules/billing";
import { BillingClient } from "./BillingClient";

export default async function BillingPage(props: PageProps<"/billing">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { status } = await props.searchParams;
  const initial = await entitlement(user.id);
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cooky Pro</h1>
      <BillingClient
        initial={initial}
        status={status === "success" || status === "cancelled" ? status : null}
        priceCents={Math.round(targets.costModel.proPriceUsd * 100)}
        poll={{ intervalMs: targets.limits.entitlementPollIntervalMs, maxMs: targets.limits.entitlementPollMaxMs }}
      />
    </section>
  );
}
