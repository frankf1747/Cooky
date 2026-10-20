// Owner: Plan & Shop. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as planning from "@/modules/planning";

// GET /api/plans/[id] · v1 · SPEC PLN8
export const GET = route({
  auth: "user",
  handler: async ({ userId, params }) => planning.getPlan(userId, params.id),
});
