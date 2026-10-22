import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_CHARS, passwordProblem } from "./password";

const long = "x".repeat(PASSWORD_MIN_CHARS);

describe("passwordProblem", () => {
  it("accepts a long enough new password typed the same twice", () => {
    expect(passwordProblem({ next: long, confirm: long })).toBeNull();
  });
  it("refuses one that is too short", () => {
    expect(passwordProblem({ next: "short", confirm: "short" })).toMatch(String(PASSWORD_MIN_CHARS));
  });
  it("refuses two that do not match", () => {
    expect(passwordProblem({ next: long, confirm: `${long}y` })).toMatch(/match/);
  });
  it("refuses reusing the current password", () => {
    expect(passwordProblem({ current: long, next: long, confirm: long })).toMatch(/different/);
  });
  it("asks for the current password when changing it", () => {
    expect(passwordProblem({ current: "", next: long, confirm: long })).toMatch(/current/);
  });
});
