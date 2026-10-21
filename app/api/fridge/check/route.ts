// Owner: Fridge. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { FridgeCheck } from "@spec/contract";
import { route } from "@/platform/handler";
import * as fridge from "@/modules/fridge";

// POST /api/fridge/check · v2 · SPEC FRG6
export const POST = route({
  auth: "user",
  body: FridgeCheck,
  handler: async ({ userId, body }) => fridge.check(userId, body),
});
