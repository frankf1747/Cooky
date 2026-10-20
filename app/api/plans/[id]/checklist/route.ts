// Owner: Plan & Shop. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { ChecklistPatch } from "@spec/contract";
import { route } from "@/platform/handler";
import * as planning from "@/modules/planning";

// PATCH /api/plans/[id]/checklist · v2 · SPEC PLN9
export const PATCH = route({
  auth: "user",
  body: ChecklistPatch,
  handler: async ({ userId, params, body }) => planning.setChecklist(userId, params.id, body),
});
