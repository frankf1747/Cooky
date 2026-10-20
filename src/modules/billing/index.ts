// Owner: Platform. Stripe test-mode checkout, webhook, entitlements (SPEC ACC5–ACC9).
// The only module that may import "stripe". Only the webhook writes entitlements.
import type { Entitlement } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function createCheckout(userId: string, email: string): Promise<{ url: string }> {
  void userId;
  void email;
  throw notImplemented("billing.createCheckout");
}

/** Verifies the Stripe signature on the raw body before anything else. */
export async function handleWebhook(req: Request): Promise<{ received: true }> {
  void req;
  throw notImplemented("billing.handleWebhook");
}

export async function entitlement(userId: string): Promise<Entitlement> {
  void userId;
  throw notImplemented("billing.entitlement");
}
