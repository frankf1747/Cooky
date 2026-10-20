import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { notImplemented } from "./errors";
import { __resetHandlerDeps, __setHandlerDeps, json, route } from "./handler";

const user = { id: "00000000-0000-0000-0000-000000000001", email: "a@example.com" };
const noParams = { params: Promise.resolve({}) };
const req = (path = "/api/x", init: RequestInit = {}) => new Request(`http://localhost${path}`, init);

afterEach(() => __resetHandlerDeps());

describe("route()", () => {
  it("returns 401 with the error body when a user route has no session", async () => {
    __setHandlerDeps({ getUser: async () => null });
    const res = await route({ auth: "user", handler: async () => ({ ok: true }) })(req(), noParams);
    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toMatch(/^req_/);
    expect(await res.json()).toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("echoes a well-formed incoming request id", async () => {
    __setHandlerDeps({ getUser: async () => user });
    const res = await route({ auth: "user", handler: async () => ({}) })(req("/api/x", { headers: { "x-request-id": "req_abc123" } }), noParams);
    expect(res.headers.get("x-request-id")).toBe("req_abc123");
  });

  it("replaces a malformed incoming request id", async () => {
    __setHandlerDeps({ getUser: async () => user });
    const res = await route({ auth: "user", handler: async () => ({}) })(req("/api/x", { headers: { "x-request-id": "<script>" } }), noParams);
    expect(res.headers.get("x-request-id")).toMatch(/^req_[0-9a-z]{26}$/);
  });

  it("maps notImplemented to 501", async () => {
    __setHandlerDeps({ getUser: async () => user });
    const res = await route({ auth: "user", handler: async () => { throw notImplemented("fridge.view"); } })(req(), noParams);
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({ code: "not_implemented" });
  });

  it("turns an unexpected error into a logged 500 without leaking the message", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await route({ auth: "public", handler: async () => { throw new Error("secret detail"); } })(req(), noParams);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ code: "internal" });
    expect(JSON.stringify(body)).not.toContain("secret detail");
    expect(spy.mock.calls.some(([line]) => String(line).includes("secret detail"))).toBe(true);
    spy.mockRestore();
  });

  it("returns 400 for a body that is not JSON", async () => {
    __setHandlerDeps({ getUser: async () => user });
    const h = route({ auth: "user", body: z.object({ a: z.number() }), handler: async () => ({}) });
    const res = await h(req("/api/x", { method: "POST", body: "{not json" }), noParams);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_input" });
  });

  it("returns 400 naming the field when the body fails the schema", async () => {
    __setHandlerDeps({ getUser: async () => user });
    const h = route({ auth: "user", body: z.object({ servings: z.number() }), handler: async () => ({}) });
    const res = await h(req("/api/x", { method: "POST", body: JSON.stringify({ servings: "two" }) }), noParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("servings");
  });

  it("passes the parsed body, query, params and user to the handler and returns 200 JSON", async () => {
    __setHandlerDeps({ getUser: async () => user });
    const h = route({
      auth: "user",
      body: z.object({ n: z.number() }),
      query: z.object({ q: z.string() }),
      handler: async ({ body, query, params, user: u }) => ({ n: body.n, q: query.q, id: params.id, uid: u?.id }),
    });
    const res = await h(req("/api/x?q=hi", { method: "POST", body: JSON.stringify({ n: 2 }) }), { params: Promise.resolve({ id: "pln_1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ n: 2, q: "hi", id: "pln_1", uid: user.id });
  });

  it("lets a handler choose the status with json()", async () => {
    __setHandlerDeps({ getUser: async () => user });
    const res = await route({ auth: "user", handler: async () => json({ itemId: "itm_1" }, 201) })(req(), noParams);
    expect(res.status).toBe(201);
    expect(res.headers.get("x-request-id")).toMatch(/^req_/);
  });

  it("returns 403 not_pro for a Free user on a Pro route", async () => {
    __setHandlerDeps({ getUser: async () => user, isPro: async () => false });
    const res = await route({ auth: "pro", handler: async () => ({}) })(req(), noParams);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_pro" });
  });

  it("lets a Pro user through a Pro route", async () => {
    __setHandlerDeps({ getUser: async () => user, isPro: async () => true });
    const res = await route({ auth: "pro", handler: async () => ({ ok: 1 }) })(req(), noParams);
    expect(res.status).toBe(200);
  });

  it("requires the cron bearer secret on cron routes", async () => {
    __setHandlerDeps({ cronSecret: () => "s3cret-value" });
    const h = route({ auth: "cron", handler: async () => ({ ran: true }) });
    expect((await h(req(), noParams)).status).toBe(401);
    expect((await h(req("/api/x", { headers: { authorization: "Bearer wrong" } }), noParams)).status).toBe(401);
    expect((await h(req("/api/x", { headers: { authorization: "Bearer s3cret-value" } }), noParams)).status).toBe(200);
  });

  it("rejects cron calls when no secret is configured", async () => {
    __setHandlerDeps({ cronSecret: () => undefined });
    const h = route({ auth: "cron", handler: async () => ({}) });
    expect((await h(req("/api/x", { headers: { authorization: "Bearer undefined" } }), noParams)).status).toBe(401);
  });
});
