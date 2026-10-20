import { describe, expect, it } from "vitest";
import { isLocalSupabase } from "./local-only";

describe("isLocalSupabase", () => {
  it("accepts the local Supabase URLs", () => {
    expect(isLocalSupabase("http://127.0.0.1:56321")).toBe(true);
    expect(isLocalSupabase("http://localhost:56321")).toBe(true);
  });
  it("refuses a hosted project, so dev tools can never grant Pro in production", () => {
    expect(isLocalSupabase("https://abcd.supabase.co")).toBe(false);
    expect(isLocalSupabase("https://127.0.0.1.evil.example")).toBe(false);
    expect(isLocalSupabase(undefined)).toBe(false);
    expect(isLocalSupabase("not a url")).toBe(false);
  });
});
