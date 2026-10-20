// Owner: Receipts & Fridge. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as fridge from "@/modules/fridge";

// GET /api/stats · v2 · SPEC FRG7
export const GET = route({
  auth: "user",
  handler: async ({ userId }) => fridge.stats(userId),
});
