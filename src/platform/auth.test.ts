import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("./db", () => ({ reader: async () => ({ auth: { getClaims } }) }));
vi.spyOn(console, "log").mockImplementation(() => {});

const { getSessionUser } = await import("./auth");

describe("getSessionUser", () => {
  beforeEach(() => getClaims.mockReset());

  it("returns the user for a valid session", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "a@b.c" } }, error: null });
    expect(await getSessionUser()).toEqual({ id: "u1", email: "a@b.c" });
  });

  it("returns null when there is no session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getSessionUser()).toBeNull();
  });

  it("returns null for an expired or invalid token, so the user is asked to sign in", async () => {
    getClaims.mockResolvedValue({ data: null, error: { name: "AuthInvalidJwtError", message: "jwt expired", status: 400 } });
    expect(await getSessionUser()).toBeNull();
  });

  it("throws 503 when the auth service cannot be reached, instead of logging everyone out", async () => {
    getClaims.mockResolvedValue({ data: null, error: { name: "AuthRetryableFetchError", message: "fetch failed", status: 0 } });
    await expect(getSessionUser()).rejects.toMatchObject({ status: 503, code: "auth_unavailable" });
  });

  it("throws 503 when the auth service answers with a server error", async () => {
    getClaims.mockResolvedValue({ data: null, error: { name: "AuthApiError", message: "upstream", status: 502 } });
    await expect(getSessionUser()).rejects.toMatchObject({ status: 503, code: "auth_unavailable" });
  });
});
