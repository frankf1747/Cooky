import { describe, expect, it } from "vitest";
import { ApiError, notImplemented, toErrorBody, tooMany } from "./errors";

describe("errors", () => {
  it("notImplemented is a 501 naming what is missing", () => {
    const e = notImplemented("fridge.cookNow");
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(501);
    expect(e.code).toBe("not_implemented");
    expect(e.message).toContain("fridge.cookNow");
  });
  it("tooMany carries resetAt into the body", () => {
    const body = toErrorBody(tooMany("2026-10-21T00:00:00Z"), "req_1");
    expect(body).toEqual({ error: "Quota exhausted", status: 429, code: "quota_exhausted", requestId: "req_1", resetAt: "2026-10-21T00:00:00Z" });
  });
  it("an unknown error becomes a 500 without leaking its message", () => {
    const body = toErrorBody(new Error("db password is hunter2"), "req_2");
    expect(body).toEqual({ error: "Internal error", status: 500, code: "internal", requestId: "req_2" });
  });
});
