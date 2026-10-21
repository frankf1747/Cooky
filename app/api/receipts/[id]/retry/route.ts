// Owner: Receipts. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as receipts from "@/modules/receipts";

// POST /api/receipts/[id]/retry · v1 · SPEC RCT7
export const POST = route({
  auth: "pro",
  handler: async ({ requestId, userId, params }) => receipts.retry(userId, params.id, requestId),
});
