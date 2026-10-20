// Owner: Plan & Shop. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { PlanSave } from "@spec/contract";
import { route } from "@/platform/handler";
import * as planning from "@/modules/planning";

// POST /api/plans/[id]/save · v1 · SPEC PLN6
export const POST = route({
  auth: "user",
  body: PlanSave,
  handler: async ({ userId, params, body }) => planning.savePlan(userId, params.id, body),
});
