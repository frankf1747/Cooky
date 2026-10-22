// Owner: Recipes & Cook. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { ImportRequest } from "@spec/contract";
import { route } from "@/platform/handler";
import * as recipes from "@/modules/recipes";

// POST /api/recipes/import · v1 for text (describe a dish, paste a recipe; Pro), v2 for links and photos · SPEC RCP4-RCP7
export const POST = route({
  auth: "pro",
  body: ImportRequest,
  handler: async ({ requestId, userId, body }) => recipes.importDraft(userId, body, requestId),
});
