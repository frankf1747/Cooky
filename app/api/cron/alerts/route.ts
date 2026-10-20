// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as alerts from "@/modules/alerts";

// GET /api/cron/alerts · v2 · SPEC ALR1, ALR5
export const GET = route({
  auth: "cron",
  handler: async () => alerts.runDaily(),
});
