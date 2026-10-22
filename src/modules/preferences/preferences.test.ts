import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Preference, PreferenceProposal } from "@spec/contract";
import { __resetAiDeps, __setAiDeps, type ModelReply } from "@/platform/ai";
import { fakeDb } from "../planning/fake-db";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

let tables: Record<string, Record<string, unknown>[]> = {};
let db = fakeDb(tables);
vi.mock("@/platform/db", () => ({
  reader: async () => db,
  writer: (userId: string) => ({ db, userId }),
}));
const preferences = await import("./index");

const reply = (proposals: unknown[]): ModelReply => ({ parsed: { proposals }, stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } });
let transport = vi.fn<(req: unknown) => Promise<ModelReply>>(async () => reply([{ kind: "soft", category: "texture", value: "saucier dishes", reason: "You said it was a bit dry." }]));

beforeEach(() => {
  tables = {
    recipes: [{ id: "rcp_chicken", owner_id: null, title: "Lemon chicken" }],
    preferences: [{ id: "prf_theirs", user_id: U2, kind: "soft", category: "flavor", value: "spicy", scope_recipe_id: null, confirmed_at: "2026-10-20T00:00:00Z", active: true }],
    preference_proposals: [],
  };
  db = fakeDb(tables);
  transport = vi.fn<(req: unknown) => Promise<ModelReply>>(async () => reply([{ kind: "soft", category: "texture", value: "saucier dishes", reason: "You said it was a bit dry." }]));
  __setAiDeps({
    transport: (req) => transport(req as never),
    recordRun: async () => {},
    spentTodayUsd: async () => 0,
    consumeQuota: async () => ({ release: async () => {} }),
    model: () => "fake",
  });
});
afterEach(() => __resetAiDeps());

describe("propose (LRN1)", () => {
  it("returns contract-valid proposals and stores them as pending, never as preferences", async () => {
    const out = await preferences.propose(U1, "Tasty, but a bit dry", { recipeId: "rcp_chicken", requestId: "req_1" });
    expect(out).toHaveLength(1);
    expect(PreferenceProposal.safeParse(out[0]).success).toBe(true);
    expect(tables.preference_proposals[0]).toMatchObject({ id: out[0].id, user_id: U1, status: "pending", source: "req_1", value: "saucier dishes" });
    expect(tables.preferences).toHaveLength(1); // only U2's
    expect(JSON.stringify(transport.mock.calls[0])).toContain("Lemon chicken");
  });

  it("an ingredient comment about one dish is scoped to it", async () => {
    transport.mockImplementationOnce(async () => reply([{ kind: "hard", category: "ingredient", value: "less garlic", reason: "Too garlicky." }]));
    const [p] = await preferences.propose(U1, "way too much garlic", { recipeId: "rcp_chicken", requestId: "req_1" });
    expect(p.scopeRecipeId).toBe("rcp_chicken");
  });

  it("nothing clear: no proposals and nothing stored; blank text skips the model", async () => {
    transport.mockImplementationOnce(async () => reply([]));
    expect(await preferences.propose(U1, "fine", { recipeId: null, requestId: "req_1" })).toEqual([]);
    expect(await preferences.propose(U1, "   ", { recipeId: null, requestId: "req_2" })).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(tables.preference_proposals).toEqual([]);
  });
});

describe("create: answering a proposal (LRN2)", () => {
  const proposal = async () => (await preferences.propose(U1, "a bit dry", { recipeId: "rcp_chicken", requestId: "req_1" }))[0];

  it("Always writes an active preference with its source request", async () => {
    const p = await proposal();
    const { preferenceId } = await preferences.create(U1, { proposalId: p.id, scope: "always" });
    expect(preferenceId).toMatch(/^prf_/);
    const saved = tables.preferences.find((r) => r.id === preferenceId)!;
    expect(saved).toMatchObject({ user_id: U1, kind: "soft", category: "texture", value: "saucier dishes", source_request_id: "req_1", active: true });
    expect(saved.confirmed_at).toBeTruthy();
    expect(tables.preference_proposals[0].status).toBe("accepted");
  });

  it("Just this time and Don't save write no preference", async () => {
    const a = await proposal();
    expect(await preferences.create(U1, { proposalId: a.id, scope: "once" })).toEqual({ preferenceId: null });
    const b = await proposal();
    expect(await preferences.create(U1, { proposalId: b.id, scope: "dismiss" })).toEqual({ preferenceId: null });
    expect(tables.preferences.filter((r) => r.user_id === U1)).toEqual([]);
    expect(tables.preference_proposals.map((r) => r.status)).toEqual(["once", "dismissed"]);
  });

  it("answering twice returns the first answer and saves once", async () => {
    const p = await proposal();
    const first = await preferences.create(U1, { proposalId: p.id, scope: "always" });
    const again = await preferences.create(U1, { proposalId: p.id, scope: "always" });
    expect(again).toEqual(first);
    const later = await preferences.create(U1, { proposalId: p.id, scope: "dismiss" });
    expect(later).toEqual(first);
    expect(tables.preferences.filter((r) => r.user_id === U1)).toHaveLength(1);
  });

  it("another user's proposal is 404", async () => {
    const p = await proposal();
    await expect(preferences.create(U2, { proposalId: p.id, scope: "always" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("list, add, edit, delete (LRN3)", () => {
  it("lists only the user's own, contract-valid", async () => {
    const { preferenceId } = await preferences.create(U1, { kind: "hard", category: "ingredient", value: " cilantro " });
    const { items } = await preferences.list(U1);
    expect(items.map((p) => p.id)).toEqual([preferenceId]);
    expect(items[0].value).toBe("cilantro");
    expect(items.every((p) => Preference.safeParse(p).success)).toBe(true);
  });

  it("edits the wording and pauses, then deletes", async () => {
    const { preferenceId } = await preferences.create(U1, { kind: "soft", category: "flavor", value: "spicy" });
    const edited = await preferences.update(U1, preferenceId!, { value: "a little spicy", active: false });
    expect(edited).toMatchObject({ value: "a little spicy", active: false });
    await preferences.remove(U1, preferenceId!);
    expect((await preferences.list(U1)).items).toEqual([]);
  });

  it("another user's preference is 404 for edit and delete", async () => {
    await expect(preferences.update(U1, "prf_theirs", { active: false })).rejects.toMatchObject({ status: 404 });
    await expect(preferences.remove(U1, "prf_theirs")).rejects.toMatchObject({ status: 404 });
    expect(tables.preferences.find((r) => r.id === "prf_theirs")).toMatchObject({ active: true });
  });
});
