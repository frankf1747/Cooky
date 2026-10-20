// Owner: Plan & Shop. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { PreferenceCreate } from "@spec/contract";
import { json, route } from "@/platform/handler";
import * as preferences from "@/modules/preferences";

// GET /api/preferences · v1 · SPEC LRN3
export const GET = route({
  auth: "user",
  handler: async ({ userId }) => preferences.list(userId),
});

// POST /api/preferences · v1 · SPEC LRN2
export const POST = route({
  auth: "user",
  body: PreferenceCreate,
  handler: async ({ userId, body }) => json(await preferences.create(userId, body), 201),
});
