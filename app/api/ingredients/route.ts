// Owner: Recipes & Cook. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { IngredientCreate } from "@spec/contract";
import { z } from "zod";
import { json, route } from "@/platform/handler";
import * as recipes from "@/modules/recipes";

const IngredientsQuery = z.object({ q: z.string().optional() });

// GET /api/ingredients · v1 · SPEC RCP2
export const GET = route({
  auth: "user",
  query: IngredientsQuery,
  handler: async ({ userId, query }) => recipes.listIngredients(userId, query.q),
});

// POST /api/ingredients · v2 · SPEC RCP9
export const POST = route({
  auth: "user",
  body: IngredientCreate,
  handler: async ({ userId, body }) => json(await recipes.createIngredient(userId, body), 201),
});
