import { describe, expect, it } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("returns a prefixed 26-char base32 id", () => {
    expect(newId("itm")).toMatch(/^itm_[0-9a-z]{26}$/);
  });
  it("sorts later ids after earlier ones", async () => {
    const a = newId("run");
    await new Promise((r) => setTimeout(r, 2));
    const b = newId("run");
    expect(a < b).toBe(true);
  });
  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId("evt")));
    expect(ids.size).toBe(1000);
  });
});
