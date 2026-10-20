// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as alerts from "@/modules/alerts";

// GET /api/alerts · v2 · SPEC ALR3
export const GET = route({
  auth: "user",
  handler: async ({ userId }) => alerts.list(userId),
});
