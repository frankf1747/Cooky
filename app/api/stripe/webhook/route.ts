// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as billing from "@/modules/billing";

// POST /api/stripe/webhook · v1 · SPEC ACC6
export const POST = route({
  auth: "stripe",
  handler: async ({ req }) => billing.handleWebhook(req),
});
