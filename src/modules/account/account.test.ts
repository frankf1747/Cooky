import { beforeEach, describe, expect, it, vi } from "vitest";
import targets from "@spec/targets.json";
import { Me, Profile } from "@spec/contract";
import { fakeDb } from "../planning/fake-db";

let db: ReturnType<typeof fakeDb>;
let tables: Record<string, Record<string, unknown>[]>;
vi.mock("@/platform/db", () => ({
  reader: async () => db,
  writer: (userId: string) => ({ db, userId }),
}));
const account = await import("./index");

const U = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const profile: Profile = {
  householdSize: 3, budgetCentsDefault: 5500, maxMinutesDefault: 25, equipment: ["oven"],
  excludedIngredientIds: ["ing_garlic"], allergenTags: [], stapleIngredientIds: ["ing_olive_oil"],
  timezone: "America/New_York", emailAlerts: false,
};

function seed(extra: Record<string, Record<string, unknown>[]> = {}) {
  tables = {
    ingredients: [
      { id: "ing_garlic", owner_id: null }, { id: "ing_olive_oil", owner_id: null },
      { id: "ing_mine", owner_id: U }, { id: "ing_theirs", owner_id: OTHER },
    ],
    profiles: [], entitlements: [], usage_counters: [],
    ...extra,
  };
  db = fakeDb(tables, { unique: { profiles: [["user_id"]] } });
}

describe("account.saveProfile (ACC3)", () => {
  beforeEach(() => seed());

  it("creates the profile for the session user and marks them onboarded", async () => {
    const saved = await account.saveProfile(U, profile);
    expect(saved).toEqual(profile);
    expect(tables.profiles).toHaveLength(1);
    expect(tables.profiles[0]).toMatchObject({ user_id: U, household_size: 3, budget_cents_default: 5500, timezone: "America/New_York" });
    expect(tables.profiles[0].onboarded_at).toBeTruthy();
  });

  it("updates an existing profile and keeps the first onboarded time", async () => {
    seed({ profiles: [{ user_id: U, household_size: 2, onboarded_at: "2026-10-01T00:00:00Z" }] });
    await account.saveProfile(U, { ...profile, householdSize: 4 });
    expect(tables.profiles).toHaveLength(1);
    expect(tables.profiles[0]).toMatchObject({ household_size: 4, onboarded_at: "2026-10-01T00:00:00Z" });
  });

  it("accepts the user's own custom ingredient", async () => {
    await expect(account.saveProfile(U, { ...profile, stapleIngredientIds: ["ing_mine"] })).resolves.toBeTruthy();
  });

  it("refuses an unknown or another user's ingredient with 404 and writes nothing", async () => {
    await expect(account.saveProfile(U, { ...profile, excludedIngredientIds: ["ing_nope"] })).rejects.toMatchObject({ status: 404 });
    await expect(account.saveProfile(U, { ...profile, stapleIngredientIds: ["ing_theirs"] })).rejects.toMatchObject({ status: 404 });
    expect(tables.profiles).toHaveLength(0);
  });

  it("refuses a timezone that is not a real IANA zone", async () => {
    await expect(account.saveProfile(U, { ...profile, timezone: "Mars/Olympus" })).rejects.toMatchObject({ status: 400, code: "invalid_input" });
  });

  it("fails loud when the database write fails", async () => {
    db = fakeDb(tables, { fail: ["profiles"] });
    await expect(account.saveProfile(U, profile)).rejects.toThrow();
  });
});

describe("account.getProfile", () => {
  beforeEach(() => seed());

  it("returns the database defaults before onboarding", async () => {
    expect(await account.getProfile(U)).toEqual({
      householdSize: 2, budgetCentsDefault: 4000, maxMinutesDefault: 30, equipment: [], excludedIngredientIds: [],
      allergenTags: [], stapleIngredientIds: [], timezone: "America/Los_Angeles", emailAlerts: false,
    });
  });

  it("returns the stored profile", async () => {
    await account.saveProfile(U, profile);
    expect(await account.getProfile(U)).toEqual(profile);
  });
});

describe("account.me (ACC4)", () => {
  beforeEach(() => seed());

  it("a new Free user: not onboarded, Free lifetime limits, nothing used", async () => {
    const me = await account.me(U, "a@test.local");
    expect(Me.safeParse(me).success).toBe(true);
    expect(me).toMatchObject({ userId: U, email: "a@test.local", plan: "free", onboarded: false });
    expect(me.quotas.plans).toEqual({ used: 0, limit: targets.quotas.free.plans_lifetime, resetAt: null });
    expect(me.quotas.swaps).toEqual({ used: 0, limit: 0, resetAt: null });
  });

  it("counts Free use from the lifetime counter", async () => {
    seed({ usage_counters: [{ user_id: U, feature: "plans", period: "lifetime", count: 1 }, { user_id: OTHER, feature: "plans", period: "lifetime", count: 9 }] });
    expect((await account.me(U, "a@test.local")).quotas.plans.used).toBe(1);
  });

  it("a Pro user: today's counter in their timezone and a reset time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T06:00:00Z")); // still 2026-10-20 in Los Angeles
    try {
      seed({
        entitlements: [{ user_id: U, plan: "pro" }],
        profiles: [{ user_id: U, timezone: "America/Los_Angeles", onboarded_at: "2026-10-01T00:00:00Z" }],
        usage_counters: [
          { user_id: U, feature: "receipts", period: "2026-10-20", count: 2 },
          { user_id: U, feature: "receipts", period: "2026-10-19", count: 7 },
        ],
      });
      const me = await account.me(U, "a@test.local");
      expect(me).toMatchObject({ plan: "pro", onboarded: true });
      expect(me.quotas.receipts).toEqual({ used: 2, limit: targets.quotas.pro.receipts_per_day, resetAt: "2026-10-21T07:00:00.000Z" });
    } finally {
      vi.useRealTimers();
    }
  });
});
