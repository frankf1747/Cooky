// Owner: Recipes & Cook. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { RecipeDraft, RecipesQuery } from "@spec/contract";
import { json, route } from "@/platform/handler";
import * as recipes from "@/modules/recipes";

// GET /api/recipes · v1 · SPEC RCP3
export const GET = route({
  auth: "user",
  query: RecipesQuery,
  handler: async ({ userId, query }) => recipes.list(userId, query),
});

// POST /api/recipes · v2 · SPEC RCP6
export const POST = route({
  auth: "user",
  body: RecipeDraft,
  handler: async ({ userId, body }) => json(await recipes.saveImported(userId, body), 201),
});
