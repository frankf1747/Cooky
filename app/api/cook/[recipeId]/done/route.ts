// Owner: Recipes & Cook. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { CookDone } from "@spec/contract";
import { route } from "@/platform/handler";
import * as cook from "@/modules/cook";

// POST /api/cook/[recipeId]/done · v1 · SPEC CK2
export const POST = route({
  auth: "user",
  body: CookDone,
  handler: async ({ userId, params, body }) => cook.done(userId, params.recipeId, body),
});
