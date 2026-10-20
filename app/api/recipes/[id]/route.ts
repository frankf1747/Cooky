// Owner: Recipes & Cook. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { json, route } from "@/platform/handler";
import * as recipes from "@/modules/recipes";

// GET /api/recipes/[id] · v1 · SPEC RCP3
export const GET = route({
  auth: "user",
  handler: async ({ userId, params }) => recipes.get(userId, params.id),
});

// DELETE /api/recipes/[id] · v2 · SPEC RCP3
export const DELETE = route({
  auth: "user",
  handler: async ({ userId, params }) => {
    await recipes.remove(userId, params.id);
    return json(null, 204);
  },
});
