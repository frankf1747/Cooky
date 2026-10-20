// The one error vocabulary (SPEC §8.1). Throw these; the handler turns them into the error body.
import type { ErrorBody } from "@spec/contract";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public resetAt?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (code = "invalid_input", message = "Invalid input") => new ApiError(400, code, message);
export const unauthorized = () => new ApiError(401, "unauthorized", "Sign in required");
export const forbidden = (code = "forbidden", message = "Not allowed") => new ApiError(403, code, message);
export const notFound = () => new ApiError(404, "not_found", "Not found");
export const conflict = (code: string, extra?: Record<string, unknown>) => new ApiError(409, code, "Conflict", undefined, extra);
export const tooLarge = () => new ApiError(413, "too_large", "Too large");
export const unprocessable = (code: string, message: string, extra?: Record<string, unknown>) =>
  new ApiError(422, code, message, undefined, extra);
export const tooMany = (resetAt: string) => new ApiError(429, "quota_exhausted", "Quota exhausted", resetAt);
export const notImplemented = (what: string) => new ApiError(501, "not_implemented", `Not implemented: ${what}`);
export const upstream = (code: string, message: string) => new ApiError(502, code, message);
export const unavailable = (code: string, message = "Temporarily unavailable") => new ApiError(503, code, message);

/** The error body for any thrown value. Unknown errors become a 500 without leaking their message. */
export function toErrorBody(err: unknown, requestId: string): ErrorBody & Record<string, unknown> {
  if (err instanceof ApiError) {
    return {
      error: err.message,
      status: err.status,
      code: err.code,
      requestId,
      ...(err.resetAt ? { resetAt: err.resetAt } : {}),
      ...(err.extra ?? {}),
    };
  }
  return { error: "Internal error", status: 500, code: "internal", requestId };
}
