import { beforeEach, describe, expect, it, vi } from "vitest";
import targets from "@spec/targets.json";
import { Entitlement } from "@spec/contract";

const USER = "11111111-1111-1111-1111-111111111111";
const SECRET = "whsec_test_secret";
const PRICE = "price_pro_test";
const AMOUNT = Math.round(targets.costModel.proPriceUsd * 100);

const stripeApi = vi.hoisted(() => ({ create: vi.fn(), listLineItems: vi.fn() }));
vi.mock("stripe", async (importOriginal) => {
  const Actual = (await importOriginal<typeof import("stripe")>()).default;
  // The real Stripe class (so webhook signatures are really checked), with network calls replaced.
  class FakeStripe extends Actual {
    constructor(key: string) {
      super(key);
      Object.assign(this.checkout.sessions, { create: stripeApi.create, listLineItems: stripeApi.listLineItems });
    }
  }
  return { default: FakeStripe };
});
vi.mock("@/platform/config", () => ({
  config: () => ({ stripeKey: "sk_test_123", stripeWebhookSecret: SECRET, stripePriceIdPro: PRICE, appUrl: "http://localhost:3000" }),
}));

const db = vi.hoisted(() => ({
  entitlements: [] as { user_id: string; plan: string; granted_at: string | null }[],
  rpc: vi.fn(),
  failRead: false,
}));
vi.mock("@/platform/db", () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: (_c: string, v: string) => ({
          maybeSingle: async () => db.failRead
            ? { data: null, error: { message: "db down" } }
            : { data: db.entitlements.find((e) => e.user_id === v) ?? null, error: null },
        }),
      }),
    }),
    rpc: (...args: unknown[]) => db.rpc(...args),
  };
  return { reader: async () => client, writer: (userId: string) => ({ db: client, userId }), systemWriter: () => client };
});

const billing = await import("./index");
const Stripe = (await import("stripe")).default;

function session(over: Record<string, unknown> = {}) {
  return {
    id: "cs_test_1", object: "checkout.session", mode: "payment", payment_status: "paid",
    amount_total: AMOUNT, currency: "usd", client_reference_id: USER, metadata: { user_id: USER }, ...over,
  };
}

async function webhook(event: { id?: string; type?: string; object?: Record<string, unknown> } = {}, opts: { secret?: string; signature?: string } = {}) {
  const payload = JSON.stringify({
    id: event.id ?? "evt_1", object: "event", type: event.type ?? "checkout.session.completed",
    data: { object: event.object ?? session() },
  });
  const header = opts.signature ?? await new Stripe("sk_test_123").webhooks.generateTestHeaderStringAsync({ payload, secret: opts.secret ?? SECRET });
  return billing.handleWebhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
}

beforeEach(() => {
  db.entitlements = [];
  db.failRead = false;
  db.rpc.mockReset();
  db.rpc.mockResolvedValue({ data: "granted", error: null });
  stripeApi.create.mockReset();
  stripeApi.listLineItems.mockReset();
  stripeApi.listLineItems.mockResolvedValue({ data: [{ price: { id: PRICE }, quantity: 1 }] });
});

describe("billing.createCheckout (ACC5, ACC8)", () => {
  it("creates a payment session for the allowlisted price, bound to the user", async () => {
    stripeApi.create.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(await billing.createCheckout(USER, "a@test.local")).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const args = stripeApi.create.mock.calls[0][0];
    expect(args).toMatchObject({
      mode: "payment", line_items: [{ price: PRICE, quantity: 1 }], client_reference_id: USER, metadata: { user_id: USER },
      customer_email: "a@test.local",
    });
    expect(args.success_url).toContain("/billing?status=success");
    expect(args.cancel_url).toContain("/billing?status=cancelled");
  });

  it("refuses an already-Pro user with 409 already_pro and never calls Stripe", async () => {
    db.entitlements = [{ user_id: USER, plan: "pro", granted_at: "2026-10-21T00:00:00Z" }];
    await expect(billing.createCheckout(USER, "a@test.local")).rejects.toMatchObject({ status: 409, code: "already_pro" });
    expect(stripeApi.create).not.toHaveBeenCalled();
  });

  it("fails loud when Stripe fails", async () => {
    stripeApi.create.mockRejectedValue(new Error("stripe down"));
    await expect(billing.createCheckout(USER, "a@test.local")).rejects.toMatchObject({ status: 502, code: "payment_error" });
  });
});

describe("billing.entitlement (ACC7)", () => {
  it("is Free with no row", async () => {
    const e = await billing.entitlement(USER);
    expect(Entitlement.safeParse(e).success).toBe(true);
    expect(e).toEqual({ plan: "free", grantedAt: null });
  });
  it("is Pro once granted", async () => {
    db.entitlements = [{ user_id: USER, plan: "pro", granted_at: "2026-10-21T00:00:00Z" }];
    expect(await billing.entitlement(USER)).toEqual({ plan: "pro", grantedAt: "2026-10-21T00:00:00Z" });
  });
  it("fails loud when the database fails", async () => {
    db.failRead = true;
    await expect(billing.entitlement(USER)).rejects.toMatchObject({ status: 502 });
  });
});

describe("billing.handleWebhook: the eight billing scenarios (ACC6, G11)", () => {
  const granted = () => db.rpc.mock.calls.filter(([fn]) => fn === "grant_pro");
  const recorded = () => db.rpc.mock.calls.filter(([fn]) => fn === "record_payment_event").map(([, a]) => (a as { p_outcome: string }).p_outcome);

  it("1. a paid checkout for the allowlisted price grants Pro in one call", async () => {
    expect(await webhook()).toEqual({ received: true });
    expect(granted()).toHaveLength(1);
    expect(granted()[0][1]).toEqual({ p_user: USER, p_session: "cs_test_1", p_event: "evt_1", p_type: "checkout.session.completed", p_amount: AMOUNT, p_currency: "usd" });
  });

  it("2–3. a replayed event or a second event for the session is answered 200 and grants nothing more", async () => {
    db.rpc.mockResolvedValue({ data: "duplicate_event", error: null });
    expect(await webhook()).toEqual({ received: true });
    db.rpc.mockResolvedValue({ data: "duplicate_session", error: null });
    expect(await webhook({ id: "evt_2", type: "checkout.session.async_payment_succeeded" })).toEqual({ received: true });
  });

  it("4. a bad signature is refused with 400 and nothing is written", async () => {
    await expect(webhook({}, { secret: "whsec_wrong" })).rejects.toMatchObject({ status: 400, code: "bad_signature" });
    await expect(webhook({}, { signature: "t=1,v1=nope" })).rejects.toMatchObject({ status: 400, code: "bad_signature" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("5. an unpaid session (e.g. a delayed method) grants nothing", async () => {
    await webhook({ object: session({ payment_status: "unpaid" }) });
    expect(granted()).toHaveLength(0);
    expect(recorded()).toEqual(["rejected:not_paid"]);
  });

  it("6. a different price grants nothing", async () => {
    stripeApi.listLineItems.mockResolvedValue({ data: [{ price: { id: "price_other" }, quantity: 1 }] });
    await webhook();
    expect(granted()).toHaveLength(0);
    expect(recorded()).toEqual(["rejected:wrong_price"]);
  });

  it("7. a different amount or currency grants nothing", async () => {
    await webhook({ object: session({ amount_total: 1 }) });
    await webhook({ id: "evt_3", object: session({ currency: "eur" }) });
    expect(granted()).toHaveLength(0);
    expect(recorded()).toEqual(["rejected:wrong_amount", "rejected:wrong_amount"]);
  });

  it("8. a user binding that is missing or does not match grants nothing", async () => {
    await webhook({ object: session({ metadata: { user_id: "22222222-2222-2222-2222-222222222222" } }) });
    await webhook({ id: "evt_4", object: session({ client_reference_id: null }) });
    expect(granted()).toHaveLength(0);
    expect(recorded()).toEqual(["rejected:user_mismatch", "rejected:user_mismatch"]);
  });

  it("other event types are acknowledged and ignored", async () => {
    expect(await webhook({ type: "checkout.session.expired" })).toEqual({ received: true });
    expect(granted()).toHaveLength(0);
    expect(recorded()).toEqual(["ignored"]);
  });

  it("a database failure throws so the route answers 500 and Stripe retries", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    await expect(webhook()).rejects.toThrow(/db down/);
  });
});
