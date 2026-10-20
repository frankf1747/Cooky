// Owner: Plan & Shop. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { PlanSwap } from "@spec/contract";
import { route } from "@/platform/handler";
import * as planning from "@/modules/planning";

// POST /api/plans/[id]/swap · v1 · SPEC PLN7
export const POST = route({
  auth: "pro",
  body: PlanSwap,
  handler: async ({ requestId, userId, params, body }) => planning.swapMeal(userId, params.id, body, requestId),
});
