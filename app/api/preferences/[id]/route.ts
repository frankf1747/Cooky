// Owner: Plan & Shop. Thin route: validate with the contract, call one module function, return.
// Every route goes through route() (src/platform/handler.ts): request id, identity, Pro check, errors.
import { PreferencePatch } from "@spec/contract";
import { json, route } from "@/platform/handler";
import * as preferences from "@/modules/preferences";

// PATCH /api/preferences/[id] · v1 · SPEC LRN3
export const PATCH = route({
  auth: "user",
  body: PreferencePatch,
  handler: async ({ userId, params, body }) => preferences.update(userId, params.id, body),
});

// DELETE /api/preferences/[id] · v1 · SPEC LRN3
export const DELETE = route({
  auth: "user",
  handler: async ({ userId, params }) => {
    await preferences.remove(userId, params.id);
    return json(null, 204);
  },
});
