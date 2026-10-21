// Owner: Platform. Stripe test-mode checkout, webhook, entitlements (SPEC ACC5–ACC9).
// The only module that may import "stripe". Only the webhook writes entitlements.
import Stripe from "stripe";
import targets from "@spec/targets.json";
import type { Entitlement } from "@spec/contract";
import { config } from "@/platform/config";
import { reader, systemWriter } from "@/platform/db";
import { ApiError, badRequest, conflict, unavailable, upstream } from "@/platform/errors";
import { log } from "@/platform/log";

/** The one Pro price, in cents (costModel.proPriceUsd); the browser can never choose it. */
const PRO_AMOUNT_CENTS = Math.round(targets.costModel.proPriceUsd * 100);
const PRO_CURRENCY = "usd";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let client: Stripe | undefined;
function stripe(): Stripe {
  const key = config().stripeKey;
  if (!key) throw unavailable("billing_unconfigured", "Payments are not set up");
  client ??= new Stripe(key);
  return client;
}

function priceId(): string {
  const id = config().stripePriceIdPro;
  if (!id) throw unavailable("billing_unconfigured", "Payments are not set up");
  return id;
}

export async function entitlement(userId: string): Promise<Entitlement> {
  const db = await reader();
  const { data, error } = await db.from("entitlements").select("plan, granted_at").eq("user_id", userId).maybeSingle();
  if (error) throw upstream("db_error", `entitlement lookup failed: ${error.message}`);
  const row = data as { plan: string; granted_at: string | null } | null;
  return row?.plan === "pro" ? { plan: "pro", grantedAt: row.granted_at } : { plan: "free", grantedAt: null };
}

/** ACC5, ACC8: a Checkout Session for the allowlisted price, bound to the session user. */
export async function createCheckout(userId: string, email: string): Promise<{ url: string }> {
  if ((await entitlement(userId)).plan === "pro") throw conflict("already_pro", { message: "You already have Cooky Pro" });
  const price = priceId();
  const appUrl = config().appUrl;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: userId,
      metadata: { user_id: userId },
      customer_email: email,
      success_url: `${appUrl}/billing?status=success`,
      cancel_url: `${appUrl}/billing?status=cancelled`,
    });
  } catch (err) {
    throw upstream("payment_error", `Stripe checkout failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!session.url) throw upstream("payment_error", "Stripe returned no checkout URL");
  return { url: session.url };
}

async function record(event: Stripe.Event, outcome: string): Promise<void> {
  const { error } = await systemWriter().rpc("record_payment_event", { p_event: event.id, p_type: event.type, p_outcome: outcome });
  if (error) throw new Error(`billing: recording ${event.id} failed: ${error.message}`);
  log("billing_webhook", { eventId: event.id, type: event.type, outcome });
}

/** Why a completed session must not grant Pro, or null when it may. */
async function refusal(s: Stripe.Checkout.Session): Promise<string | null> {
  if (s.payment_status !== "paid") return "not_paid";
  const user = s.client_reference_id;
  if (!user || !UUID.test(user) || s.metadata?.user_id !== user) return "user_mismatch";
  if (s.amount_total !== PRO_AMOUNT_CENTS || s.currency !== PRO_CURRENCY) return "wrong_amount";
  const items = await stripe().checkout.sessions.listLineItems(s.id);
  if (items.data.length !== 1 || items.data[0].price?.id !== priceId() || items.data[0].quantity !== 1) return "wrong_price";
  return null;
}

/**
 * ACC6: verifies the Stripe signature on the raw body before anything else. Pro is granted only
 * for a paid session with the allowlisted price, amount, currency and a matching user; order and
 * entitlement are written by grant_pro() in one transaction. A database failure throws (500) so
 * Stripe retries; a refused event is recorded and answered 200 so Stripe stops retrying.
 */
export async function handleWebhook(req: Request): Promise<{ received: true }> {
  const secret = config().stripeWebhookSecret;
  if (!secret) throw unavailable("billing_unconfigured", "Payments are not set up");
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("missing Stripe-Signature header");
    event = await stripe().webhooks.constructEventAsync(raw, signature, secret);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw badRequest("bad_signature", "Webhook signature verification failed");
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    await record(event, "ignored");
    return { received: true };
  }
  const s = event.data.object;
  const why = await refusal(s);
  if (why) {
    await record(event, `rejected:${why}`);
    return { received: true };
  }
  const { data, error } = await systemWriter().rpc("grant_pro", {
    p_user: s.client_reference_id, p_session: s.id, p_event: event.id, p_type: event.type,
    p_amount: s.amount_total, p_currency: s.currency,
  });
  if (error) throw new Error(`billing: granting Pro for ${event.id} failed: ${error.message}`);
  log("billing_webhook", { eventId: event.id, type: event.type, outcome: data });
  return { received: true };
}
