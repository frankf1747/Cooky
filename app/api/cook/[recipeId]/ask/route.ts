// Owner: Recipes & Cook. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { CookAsk } from "@spec/contract";
import { route } from "@/platform/handler";
import * as cook from "@/modules/cook";

// POST /api/cook/[recipeId]/ask · v1 · SPEC ASK1-ASK5
export const POST = route({
  auth: "pro",
  body: CookAsk,
  handler: async ({ requestId, userId, params, body }) => cook.ask(userId, params.recipeId, body, requestId),
});
