import { describe, expect, it } from "vitest";
import targets from "@spec/targets.json";
import { quotaLimit, quotaPeriod } from "./quotas";

describe("quotas", () => {
  it("reads Free lifetime and Pro daily limits from targets.json", () => {
    expect(quotaLimit("plans", "free")).toBe(targets.quotas.free.plans_lifetime);
    expect(quotaLimit("receipts", "free")).toBe(targets.quotas.free.receipts_lifetime);
    expect(quotaLimit("receipts", "pro")).toBe(targets.quotas.pro.receipts_per_day);
    expect(quotaLimit("cook_answers", "pro")).toBe(targets.quotas.pro.cook_answers_per_day);
  });

  it("treats a feature with no Free entry as Pro-only", () => {
    expect(quotaLimit("swaps", "free")).toBe(0);
  });

  it("uses a lifetime period for Free and the local calendar day for Pro, resetting at local midnight in UTC", () => {
    const now = new Date("2026-10-21T05:30:00Z"); // 22:30 on 2026-10-20 in Los Angeles (UTC-7)
    expect(quotaPeriod("free", "America/Los_Angeles", now)).toEqual({ period: "lifetime", resetAt: null });
    expect(quotaPeriod("pro", "America/Los_Angeles", now)).toEqual({ period: "2026-10-20", resetAt: "2026-10-21T07:00:00.000Z" });
  });

  it("gets local midnight right across the end of daylight saving time", () => {
    // 2026-11-01 is the day Los Angeles leaves daylight time (UTC-7 -> UTC-8).
    expect(quotaPeriod("pro", "America/Los_Angeles", new Date("2026-10-31T20:00:00Z")).resetAt).toBe("2026-11-01T07:00:00.000Z");
    expect(quotaPeriod("pro", "America/Los_Angeles", new Date("2026-11-02T05:00:00Z")).resetAt).toBe("2026-11-02T08:00:00.000Z");
  });
});
