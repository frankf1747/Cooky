// Owner: Receipts & Fridge. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { FridgeItemPatch } from "@spec/contract";
import { route } from "@/platform/handler";
import * as fridge from "@/modules/fridge";

// PATCH /api/fridge/items/[id] · v1 · SPEC FRG4
export const PATCH = route({
  auth: "user",
  body: FridgeItemPatch,
  handler: async ({ userId, params, body }) => fridge.updateItem(userId, params.id, body),
});
