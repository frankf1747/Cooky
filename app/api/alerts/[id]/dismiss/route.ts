// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { json, route } from "@/platform/handler";
import * as alerts from "@/modules/alerts";

// POST /api/alerts/[id]/dismiss · v2 · SPEC ALR3
export const POST = route({
  auth: "user",
  handler: async ({ userId, params }) => {
    await alerts.dismiss(userId, params.id);
    return json(null, 204);
  },
});
