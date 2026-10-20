// Owner: Plan & Shop. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { PlanCreate } from "@spec/contract";
import { route } from "@/platform/handler";
import * as planning from "@/modules/planning";

// POST /api/plans · v1 · SPEC PLN1-PLN6
export const POST = route({
  auth: "user",
  body: PlanCreate,
  handler: async ({ requestId, userId, body }) => planning.createPlan(userId, body, requestId),
});

// GET /api/plans · v1 · SPEC PLN8
export const GET = route({
  auth: "user",
  handler: async ({ userId }) => planning.listPlans(userId),
});
