// Owner: Fridge. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { FridgeItemCreate } from "@spec/contract";
import { json, route } from "@/platform/handler";
import * as fridge from "@/modules/fridge";

// POST /api/fridge/items · v1 · SPEC FRG4
export const POST = route({
  auth: "user",
  body: FridgeItemCreate,
  handler: async ({ userId, body }) => json(await fridge.addItem(userId, body), 201),
});
