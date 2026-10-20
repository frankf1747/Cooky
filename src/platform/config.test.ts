import { describe, expect, it } from "vitest";
import { assertSafeStripeKey, readConfig } from "./config";

describe("config", () => {
  it("defaults to fake AI mode when no Anthropic key is set", () => {
    expect(readConfig({}).aiMode).toBe("fake");
  });
  it("uses live AI mode only when a key is set and AI_MODE is not fake", () => {
    expect(readConfig({ ANTHROPIC_API_KEY: "k" }).aiMode).toBe("live");
    expect(readConfig({ ANTHROPIC_API_KEY: "k", AI_MODE: "fake" }).aiMode).toBe("fake");
  });
  it("takes the model from env with the cheap default", () => {
    expect(readConfig({}).models.default).toBe("claude-haiku-5-5");
    expect(readConfig({ RECEIPT_MODEL: "claude-sonnet-5-5" }).models.receipt_reader).toBe("claude-sonnet-5-5");
    expect(readConfig({}).models.receipt_reader).toBe("claude-haiku-5-5");
  });
  it("refuses a live Stripe key and accepts a test key or none", () => {
    expect(() => assertSafeStripeKey("sk_live_abc")).toThrow(/test/);
    expect(() => assertSafeStripeKey("rk_live_abc")).toThrow(/test/);
    expect(() => assertSafeStripeKey("sk_test_abc")).not.toThrow();
    expect(() => assertSafeStripeKey(undefined)).not.toThrow();
  });
  it("reports the Stripe mode without exposing the key", () => {
    expect(readConfig({ STRIPE_SECRET_KEY: "sk_test_abc" }).stripeMode).toBe("test");
    expect(readConfig({}).stripeMode).toBe("unset");
  });
});
