// The AI gateway (SPEC §6.3, PLT2). Every model call in Cooky goes through runAi():
//   quota (atomic) → team spend cap → model call(s) with structured output → schema check →
//   caller's id/rule validation → bounded repairs → one run record → output or an honest error.
// This is the only file that imports @anthropic-ai/sdk (enforced by `npm run check`).
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodObject, ZodType } from "zod";
import targets from "@spec/targets.json";
import type { AiUnitName, RunInfo, RunRecord } from "@spec/contract";
import { ApiError, unavailable } from "./errors";
import { aiFixtures } from "./ai-fixtures";
import { config } from "./config";
import { writer } from "./db";
import { newId } from "./ids";
import { log } from "./log";
import type { QuotaFeature } from "./quotas";

export type ContentBlock = Anthropic.ContentBlockParam;

export type AiCall<T> = {
  unit: AiUnitName;
  userId: string;
  requestId: string;
  /** zod object schema for the output; also sent to the model as the structured-output format */
  schema: ZodType<T>;
  /** stable instructions and catalogs first (cached); never per-request data */
  system: string;
  /** this request's data: user text, receipt image, retrieved chunks, all as delimited data */
  content: ContentBlock[];
  /** rule checks code owns (ids in the candidate set, allowed categories...); return violations */
  validate?: (out: T) => string[];
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  /** which quota this call counts against; defaults from the unit */
  quotaFeature?: QuotaFeature;
};

export type ModelReply = {
  parsed: unknown;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
};

type TransportRequest = {
  unit: AiUnitName;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  schema: ZodType<unknown>;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  timeoutMs: number;
};

type Deps = {
  transport: (req: TransportRequest) => Promise<ModelReply>;
  recordRun: (rec: RunRecord & { userId: string }) => Promise<void>;
  spentTodayUsd: () => Promise<number>;
  consumeQuota: (userId: string, feature: QuotaFeature) => Promise<{ release: () => Promise<void> }>;
  model: (unit: AiUnitName) => string;
};

const UNIT_QUOTA: Record<AiUnitName, QuotaFeature> = {
  receipt_reader: "receipts",
  recipe_importer: "imports",
  planner: "plans",
  cook_assistant: "cook_answers",
  preference_proposer: "preference_proposals",
};

// ---------------------------------------------------------------- transports

let client: Anthropic | undefined;

const liveTransport: Deps["transport"] = async (req) => {
  client ??= new Anthropic({ apiKey: config().anthropicKey, maxRetries: 1 });
  const res = await client.messages.parse(
    {
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
      output_config: { format: zodOutputFormat(req.schema as ZodObject), effort: req.effort },
    },
    { timeout: req.timeoutMs },
  );
  return {
    parsed: res.parsed_output ?? null,
    stopReason: res.stop_reason,
    usage: {
      inputTokens: res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0),
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
    },
  };
};

const fakeTransport: Deps["transport"] = async (req) => {
  const text = req.messages
    .flatMap((m) => (typeof m.content === "string" ? [m.content] : m.content.map((b) => (b.type === "text" ? b.text : ""))))
    .join("\n");
  return { parsed: aiFixtures[req.unit]({ system: req.system, text }), stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } };
};

const defaultDeps: Deps = {
  transport: (req) => (config().aiMode === "live" ? liveTransport(req) : fakeTransport(req)),
  recordRun: async (rec) => {
    const { db } = writer(rec.userId);
    const { error } = await db.from("runs").insert({
      id: rec.runId,
      user_id: rec.userId,
      request_id: rec.requestId,
      unit: rec.unit,
      model: rec.model,
      terminated: rec.terminated,
      wall_ms: rec.wallMs,
      input_tokens: rec.inputTokens,
      output_tokens: rec.outputTokens,
      cache_read_tokens: rec.cacheReadTokens,
      cost_usd: rec.costUsd,
      repairs: rec.repairs,
      steps: rec.steps,
      error: rec.error ?? null,
    });
    if (error) throw new Error(error.message);
  },
  // System read: `runs` has no client policy (server only), so this uses the secret-key client.
  spentTodayUsd: async () => {
    const { db } = writer("system");
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data, error } = await db.from("runs").select("cost_usd").gte("created_at", since.toISOString());
    if (error) throw new ApiError(502, "db_error", `spend lookup failed: ${error.message}`);
    return (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  },
  consumeQuota: async (userId, feature) => (await import("./quotas")).consumeQuota(userId, feature),
  model: (unit) => (config().aiMode === "live" ? config().models[unit] : "fake"),
};
let deps: Deps = defaultDeps;

/** Test seam: replace the transport, run recorder, spend lookup, quota or model choice. */
export function __setAiDeps(d: Partial<Deps>): void {
  deps = { ...defaultDeps, ...d };
}
export function __resetAiDeps(): void {
  deps = defaultDeps;
}

// ---------------------------------------------------------------- cost

function costUsd(model: string, u: ModelReply["usage"]): number {
  const prices = (targets.costModel.usdPerMillionTokens as Record<string, { input: number; output: number; cacheRead?: number }>)[model];
  if (!prices) return 0; // fake mode, or a model missing from targets.json (logged below)
  return (u.inputTokens * prices.input + u.outputTokens * prices.output + u.cacheReadTokens * (prices.cacheRead ?? prices.input)) / 1_000_000;
}

// ---------------------------------------------------------------- runAi

export async function runAi<T>(call: AiCall<T>): Promise<{ output: T; run: RunInfo }> {
  const budget = targets.budgets[call.unit];
  const started = Date.now();
  const model = deps.model(call.unit);
  if (model !== "fake" && !(model in targets.costModel.usdPerMillionTokens))
    log("ai_unpriced_model", { unit: call.unit, model, requestId: call.requestId });

  if ((await deps.spentTodayUsd()) >= targets.limits.globalDailySpendCapUsd)
    throw unavailable("ai_paused", "AI features are paused for today: the daily spend cap was reached");
  const quota = await deps.consumeQuota(call.userId, call.quotaFeature ?? UNIT_QUOTA[call.unit]);

  const rec: RunRecord & { userId: string } = {
    runId: newId("run"),
    requestId: call.requestId,
    userId: call.userId,
    unit: call.unit,
    model,
    terminated: "error",
    wallMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    repairs: 0,
    steps: [],
  };
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: call.content }];
  const attempts = Math.min(budget.maxRepairs + 1, budget.maxSteps);
  let failure: ApiError | undefined;
  let output: T | undefined;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const elapsed = Date.now() - started;
    if (elapsed >= budget.maxWallClockSec * 1000 || rec.costUsd >= budget.maxCostUsd) {
      rec.terminated = "cap";
      failure = new ApiError(502, "budget_exceeded", `AI ${call.unit} hit its time or cost cap`);
      break;
    }
    if (attempt > 0) rec.repairs++;

    const t0 = Date.now();
    let reply: ModelReply;
    try {
      reply = await deps.transport({
        unit: call.unit,
        model,
        system: call.system,
        messages,
        schema: call.schema as ZodType<unknown>,
        effort: call.effort ?? "low",
        maxTokens: call.maxTokens ?? 8000,
        timeoutMs: budget.maxWallClockSec * 1000 - elapsed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      rec.steps.push({ name: attempt ? "model_repair" : "model_call", ok: false, ms: Date.now() - t0, error: msg });
      failure = new ApiError(502, "model_error", `AI ${call.unit} failed: the model provider returned an error`);
      break;
    }
    rec.inputTokens += reply.usage.inputTokens;
    rec.outputTokens += reply.usage.outputTokens;
    rec.cacheReadTokens += reply.usage.cacheReadTokens;
    rec.costUsd += costUsd(model, reply.usage);
    rec.steps.push({ name: attempt ? "model_repair" : "model_call", ok: true, ms: Date.now() - t0 });

    if (reply.stopReason === "refusal") {
      rec.steps.push({ name: "refusal", ok: false, ms: 0, error: "model declined the request" });
      failure = new ApiError(422, "ai_refused", "The AI declined this request");
      break;
    }

    const parsed = call.schema.safeParse(reply.parsed);
    const violations = parsed.success
      ? (call.validate?.(parsed.data) ?? [])
      : parsed.error.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
    rec.steps.push(violations.length ? { name: "validate", ok: false, ms: 0, error: violations.join("; ") } : { name: "validate", ok: true, ms: 0 });

    if (rec.costUsd > budget.maxCostUsd) {
      rec.terminated = "cap";
      failure = new ApiError(502, "budget_exceeded", `AI ${call.unit} exceeded its cost cap`);
      break;
    }
    if (parsed.success && violations.length === 0) {
      rec.terminated = "done";
      output = parsed.data;
      break;
    }
    messages.push({ role: "assistant", content: JSON.stringify(reply.parsed ?? null) });
    messages.push({
      role: "user",
      content: `Your previous answer broke these rules:\n- ${violations.join("\n- ")}\nReturn a corrected answer that follows the schema and uses only the ids you were given.`,
    });
    failure = new ApiError(502, "model_error", `AI ${call.unit} returned invalid output`);
  }

  rec.wallMs = Date.now() - started;
  if (rec.terminated === "done") failure = undefined;
  if (failure && rec.terminated === "done") rec.terminated = "error";
  rec.error = failure?.message;
  try {
    await deps.recordRun(rec);
  } catch (err) {
    log("run_record_failed", { runId: rec.runId, requestId: rec.requestId, error: err instanceof Error ? err.message : String(err) });
  }

  if (rec.terminated !== "done") {
    // A failed attempt should not cost the user one of their uses.
    try {
      await quota.release();
    } catch (err) {
      log("quota_release_failed", { runId: rec.runId, requestId: rec.requestId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const run: RunInfo = { runId: rec.runId, terminated: rec.terminated, latencyMs: rec.wallMs, costUsd: Math.round(rec.costUsd * 1e6) / 1e6 };
  if (rec.terminated !== "done" || output === undefined) {
    const f = failure ?? new ApiError(502, "model_error", `AI ${call.unit} returned invalid output`);
    throw new ApiError(f.status, f.code, f.message, undefined, { run });
  }
  return { output, run };
}
