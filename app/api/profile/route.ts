// Owner: Platform. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { ProfileInput } from "@spec/contract";
import { route } from "@/platform/handler";
import * as account from "@/modules/account";

// PUT /api/profile · v1 · SPEC ACC3
export const PUT = route({
  auth: "user",
  body: ProfileInput,
  handler: async ({ userId, body }) => account.saveProfile(userId, body),
});
