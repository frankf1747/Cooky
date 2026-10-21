import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const profile = vi.hoisted(() => ({ row: null as { timezone: string } | null, error: null as { message: string } | null }));
vi.mock("./db", () => ({
  reader: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile.row, error: profile.error }) }) }) }),
  }),
}));

import { DEFAULT_TIMEZONE, localDate, localToday } from "./dates";

// 06:00 UTC on 2026-10-21 is still 23:00 on 2026-10-20 in Los Angeles.
const evening = new Date("2026-10-21T06:00:00Z");

describe("dates", () => {
  beforeEach(() => {
    profile.row = null;
    profile.error = null;
  });

  it("formats the local calendar date in a timezone", () => {
    expect(localDate("America/Los_Angeles", evening)).toBe("2026-10-20");
    expect(localDate("UTC", evening)).toBe("2026-10-21");
  });

  it("uses the user's profile timezone for today", async () => {
    profile.row = { timezone: "Asia/Tokyo" };
    expect(await localToday("u1", evening)).toBe("2026-10-21");
  });

  it("uses the profiles.timezone default, not UTC, before the user has a profile", async () => {
    expect(await localToday("u1", evening)).toBe("2026-10-20");
  });

  it("keeps the default timezone the same as the database column default", () => {
    const init = readFileSync("supabase/migrations/20261020000000_init.sql", "utf8");
    expect(init).toContain(`timezone text not null default '${DEFAULT_TIMEZONE}'`);
  });

  it("fails loud when the profile cannot be read", async () => {
    profile.error = { message: "connection refused" };
    await expect(localToday("u1", evening)).rejects.toMatchObject({ status: 502, code: "db_error" });
  });
});
