// Owner: Receipts & Fridge. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as fridge from "@/modules/fridge";

// GET /api/fridge · v1 · SPEC FRG3
export const GET = route({
  auth: "user",
  handler: async ({ userId }) => fridge.view(userId),
});
