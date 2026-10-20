// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as billing from "@/modules/billing";

// GET /api/billing/entitlement · v1 · SPEC ACC7
export const GET = route({
  auth: "user",
  handler: async ({ userId }) => billing.entitlement(userId),
});
