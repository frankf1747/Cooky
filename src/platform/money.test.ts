import { describe, expect, it } from "vitest";
import { formatUsd, sumCents } from "./money";

describe("money", () => {
  it("formats integer cents as dollars", () => {
    expect(formatUsd(1050)).toBe("$10.50");
    expect(formatUsd(0)).toBe("$0.00");
  });
  it("formats an unknown price as words, never as zero", () => {
    expect(formatUsd(null)).toBe("price unknown");
  });
  it("sums known cents and counts the unknown ones", () => {
    expect(sumCents([100, null, 250])).toEqual({ total: 350, unknownCount: 1 });
    expect(sumCents([])).toEqual({ total: 0, unknownCount: 0 });
  });
  it("refuses non-integer cents", () => {
    expect(() => sumCents([10.5])).toThrow(/integer cents/);
  });
});
