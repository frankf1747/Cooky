// Owner: Recipes & Cook. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { CookConfirm } from "@spec/contract";
import { route } from "@/platform/handler";
import * as cook from "@/modules/cook";

// POST /api/cook/events/[id]/confirm · v1 · SPEC CK3
export const POST = route({
  auth: "user",
  body: CookConfirm,
  handler: async ({ requestId, userId, params, body }) => cook.confirm(userId, params.id, body, requestId),
});
