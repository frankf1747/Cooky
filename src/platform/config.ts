// Environment, parsed once. Secrets are read only on the server; nothing here is NEXT_PUBLIC_ except
// the Supabase URL and publishable key.
import targets from "@spec/targets.json";
import type { AiUnitName } from "@spec/contract";

type Env = Record<string, string | undefined>;

export type Config = {
  aiMode: "fake" | "live";
  anthropicKey: string | undefined;
  models: Record<AiUnitName, string> & { default: string };
  stripeMode: "test" | "unset";
  stripeKey: string | undefined;
  stripeWebhookSecret: string | undefined;
  stripePriceIdPro: string | undefined;
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  supabaseSecretKey: string | undefined;
  cronSecret: string | undefined;
  appUrl: string;
};

/** Throws when a Stripe key is set and is not a test key (SPEC ACC9). */
export function assertSafeStripeKey(key: string | undefined): void {
  if (key && !/^(sk|rk)_test_/.test(key)) throw new Error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...)");
}

export function readConfig(env: Env): Config {
  assertSafeStripeKey(env.STRIPE_SECRET_KEY);
  const def = env.CLAUDE_MODEL || targets.costModel.defaultModel;
  return {
    aiMode: env.ANTHROPIC_API_KEY && env.AI_MODE !== "fake" ? "live" : "fake",
    anthropicKey: env.ANTHROPIC_API_KEY || undefined,
    models: {
      default: def,
      receipt_reader: env.RECEIPT_MODEL || def,
      recipe_importer: def,
      planner: def,
      cook_assistant: def,
      preference_proposer: def,
    },
    stripeMode: env.STRIPE_SECRET_KEY ? "test" : "unset",
    stripeKey: env.STRIPE_SECRET_KEY || undefined,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || undefined,
    stripePriceIdPro: env.STRIPE_PRICE_ID_PRO || undefined,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    supabasePublishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    supabaseSecretKey: env.SUPABASE_SECRET_KEY || undefined,
    cronSecret: env.CRON_SECRET || undefined,
    appUrl: env.APP_URL || "http://localhost:3000",
  };
}

let cached: Config | undefined;
/** The process config, read lazily so build steps without env do not fail. */
export function config(): Config {
  cached ??= readConfig(process.env);
  return cached;
}
