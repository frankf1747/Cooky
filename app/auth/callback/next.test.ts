import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps a path inside the app", () => {
    expect(safeNext("/reset-password")).toBe("/reset-password");
  });
  it("falls back to onboarding when missing", () => {
    expect(safeNext(null)).toBe("/onboarding");
  });
  it("never redirects off the site", () => {
    expect(safeNext("https://evil.example")).toBe("/onboarding");
    expect(safeNext("//evil.example")).toBe("/onboarding");
    expect(safeNext("/\\evil.example")).toBe("/onboarding");
  });
});
