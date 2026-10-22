import { describe, expect, it } from "vitest";
import { staleIds } from "./seed-prune";

describe("staleIds", () => {
  it("returns the database ids the CSV no longer lists", () => {
    expect(staleIds(["prd_a", "prd_old", "prd_b", "prd_gone"], ["prd_a", "prd_b", "prd_new"])).toEqual(["prd_old", "prd_gone"]);
  });

  it("returns nothing when the database matches the CSV", () => {
    expect(staleIds(["prd_a", "prd_b"], ["prd_b", "prd_a"])).toEqual([]);
  });

  it("refuses to prune everything when the CSV is empty", () => {
    expect(() => staleIds(["prd_a"], [])).toThrow(/empty/);
  });
});
