// Owner: Platform. Pure helpers for the billing page (safe on server and client).
import type { Entitlement } from "@spec/contract";

export type BillingError = { message: string; retry: boolean };

/** One honest sentence for each error the billing routes can return (SPEC §8.1, ACC5–ACC8). */
export function billingErrorMessage(status: number, body: { code?: string }): BillingError {
  switch (body.code) {
    case "already_pro":
      return { message: "You already have Cooky Pro.", retry: false };
    case "billing_unconfigured":
      return { message: "Payments aren't set up on this copy of Cooky yet.", retry: false };
    case "payment_error":
      return { message: "Stripe couldn't start the checkout. Nothing was charged; try again.", retry: true };
    default:
      if (status === 401) return { message: "Your session ended. Log in again.", retry: false };
      return { message: "Something went wrong. Nothing was charged; try again.", retry: true };
  }
}


/**
 * ACC7: after Stripe sends the user back, check the entitlement every `intervalMs` until the
 * webhook has granted Pro, for at most `maxMs`. The return URL itself never unlocks anything.
 */
export async function waitForPro(o: {
  check: () => Promise<Entitlement | null>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  cancelled: () => boolean;
  intervalMs: number;
  maxMs: number;
}): Promise<Entitlement | "timeout" | "cancelled"> {
  const started = o.now();
  for (;;) {
    if (o.cancelled()) return "cancelled";
    const e = await o.check();
    if (o.cancelled()) return "cancelled";
    if (e?.plan === "pro") return e;
    // The next check would land past the limit: stop and let the page offer a manual refresh.
    if (o.now() - started + o.intervalMs > o.maxMs) return "timeout";
    await o.sleep(o.intervalMs);
  }
}
