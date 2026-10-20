// Owner: Receipts & Fridge. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { ReceiptConfirm } from "@spec/contract";
import { route } from "@/platform/handler";
import * as receipts from "@/modules/receipts";

// POST /api/receipts/[id]/confirm · v1 · SPEC RCT6
export const POST = route({
  auth: "user",
  body: ReceiptConfirm,
  handler: async ({ userId, params, body }) => receipts.confirm(userId, params.id, body),
});
