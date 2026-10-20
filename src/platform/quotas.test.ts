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

  it("uses a lifetime period for Free and the local calendar day for Pro", () => {
    const now = new Date("2026-10-21T05:30:00Z"); // 22:30 on 2026-10-20 in Los Angeles
    expect(quotaPeriod("free", "America/Los_Angeles", now)).toEqual({ period: "lifetime", resetAt: null });
    expect(quotaPeriod("pro", "America/Los_Angeles", now)).toEqual({ period: "2026-10-20", resetAt: "2026-10-21T00:00:00[America/Los_Angeles]" });
  });
});
