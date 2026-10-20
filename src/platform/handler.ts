// Every API route goes through route(): request id, identity, Pro check, validation, error mapping
// and one log line. Route files stay thin: `export const GET = route({ auth: "user", handler })`.
import type { ZodType } from "zod";
import type { Auth } from "@spec/routes";
import { ApiError, badRequest, forbidden, toErrorBody, unauthorized } from "./errors";
import { newId } from "./ids";
import { log } from "./log";
import type { SessionUser } from "./auth";
import { config } from "./config";

export type Ctx<B, Q> = {
  req: Request;
  requestId: string;
  user: SessionUser | null;
  params: Record<string, string>;
  body: B;
  query: Q;
};

type RouteOptions<B, Q> = {
  auth: Auth;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  handler: (ctx: Ctx<B, Q>) => Promise<unknown>;
};

type Deps = {
  getUser: () => Promise<SessionUser | null>;
  isPro: (userId: string) => Promise<boolean>;
  cronSecret: () => string | undefined;
};

const defaultDeps: Deps = {
  getUser: async () => (await import("./auth")).getSessionUser(),
  isPro: async (userId) => (await import("./auth")).isPro(userId),
  cronSecret: () => config().cronSecret,
};
let deps: Deps = defaultDeps;

/** Test seam: replace identity lookups. */
export function __setHandlerDeps(d: Partial<Deps>): void {
  deps = { ...defaultDeps, ...d };
}
export function __resetHandlerDeps(): void {
  deps = defaultDeps;
}

/** Return this from a handler to choose the status (201, 204...). Plain objects become 200 JSON. */
export function json(data: unknown, status = 200): Response {
  return status === 204 ? new Response(null, { status }) : Response.json(data, { status });
}

const REQUEST_ID = /^[A-Za-z0-9_.-]{1,64}$/;

function issuesMessage(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");
}

export function route<B = undefined, Q = undefined>(opts: RouteOptions<B, Q>) {
  return async (req: Request, info?: { params?: Promise<Record<string, string | string[]>> }): Promise<Response> => {
    const started = Date.now();
    const incoming = req.headers.get("x-request-id");
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : newId("req");
    const url = new URL(req.url);
    let res: Response;
    try {
      let user: SessionUser | null = null;
      if (opts.auth === "user" || opts.auth === "pro") {
        user = await deps.getUser();
        if (!user) throw unauthorized();
        if (opts.auth === "pro" && !(await deps.isPro(user.id))) throw forbidden("not_pro", "Cooky Pro required");
      } else if (opts.auth === "cron") {
        const secret = deps.cronSecret();
        if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw unauthorized();
      }

      const rawParams = (await info?.params) ?? {};
      const params = Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : v]));

      let query = undefined as Q;
      if (opts.query) {
        const parsed = opts.query.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) throw badRequest("invalid_input", issuesMessage(parsed.error.issues));
        query = parsed.data;
      }

      let body = undefined as B;
      if (opts.body) {
        let raw: unknown;
        try {
          raw = JSON.parse(await req.text());
        } catch {
          throw badRequest("invalid_input", "Body is not valid JSON");
        }
        const parsed = opts.body.safeParse(raw);
        if (!parsed.success) throw badRequest("invalid_input", issuesMessage(parsed.error.issues));
        body = parsed.data;
      }

      const out = await opts.handler({ req, requestId, user, params, body, query });
      res = out instanceof Response ? out : Response.json(out ?? null, { status: 200 });
    } catch (err) {
      const body = toErrorBody(err, requestId);
      if (!(err instanceof ApiError) || body.status >= 500)
        log("request_error", { requestId, method: req.method, path: url.pathname, status: body.status, error: err instanceof Error ? err.message : String(err) });
      res = Response.json(body, { status: body.status });
    }
    res.headers.set("x-request-id", requestId);
    log("request", { requestId, method: req.method, path: url.pathname, status: res.status, ms: Date.now() - started });
    return res;
  };
}
