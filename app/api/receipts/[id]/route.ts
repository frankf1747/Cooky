// Owner: Receipts. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { json, route } from "@/platform/handler";
import * as receipts from "@/modules/receipts";

// GET /api/receipts/[id] · v1 · SPEC RCT2
export const GET = route({
  auth: "user",
  handler: async ({ userId, params }) => receipts.get(userId, params.id),
});

// DELETE /api/receipts/[id] · v1 · SPEC RCT9
export const DELETE = route({
  auth: "user",
  handler: async ({ userId, params }) => {
    await receipts.remove(userId, params.id);
    return json(null, 204);
  },
});
