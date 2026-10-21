// Owner: Receipts. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as receipts from "@/modules/receipts";

// POST /api/receipts · v1 · SPEC RCT1-RCT4
export const POST = route({
  auth: "pro",
  handler: async ({ req, requestId, userId }) => receipts.upload(userId, await req.formData(), requestId),
});
