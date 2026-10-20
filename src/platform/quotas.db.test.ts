import { describe, expect, it, vi } from "vitest";

// tierAndTimezone must read through the user's own session (RLS), never the secret-key writer.
const select = (table: string) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: async () =>
        table === "entitlements" ? { data: { plan: "pro" }, error: null } : { data: { timezone: "America/New_York" }, error: null },
    }),
  }),
});
vi.mock("./db", () => ({
  reader: async () => ({ from: select }),
  writer: () => ({
    db: {
      from: () => {
        throw new Error("writer used for a read");
      },
    },
  }),
}));

const { tierAndTimezone } = await import("./quotas");

describe("tierAndTimezone", () => {
  it("reads the tier and timezone with the user's session", async () => {
    expect(await tierAndTimezone("u1")).toEqual({ plan: "pro", tz: "America/New_York" });
  });
});
