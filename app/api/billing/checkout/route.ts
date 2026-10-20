// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as billing from "@/modules/billing";

// POST /api/billing/checkout · v1 · SPEC ACC5, ACC8
export const POST = route({
  auth: "user",
  handler: async ({ user, userId }) => billing.createCheckout(userId, user!.email),
});
