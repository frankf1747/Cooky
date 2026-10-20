// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { route } from "@/platform/handler";
import * as account from "@/modules/account";

// GET /api/me · v1 · SPEC ACC4
export const GET = route({
  auth: "user",
  handler: async ({ user, userId }) => account.me(userId, user!.email),
});
