import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import targets from "@spec/targets.json";
import type { RunRecord } from "@spec/contract";
import { ApiError } from "./errors";
import { __resetAiDeps, __setAiDeps, runAi, type ModelReply } from "./ai";

const Out = z.object({ pick: z.string() });
const records: RunRecord[] = [];

const released: string[] = [];

function setup(replies: (ModelReply | Error)[], extra: Parameters<typeof __setAiDeps>[0] = {}) {
  records.length = 0;
  released.length = 0;
  let i = 0;
  __setAiDeps({
    transport: async () => {
      const r = replies[Math.min(i++, replies.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
    recordRun: async (rec) => void records.push(rec),
    spentTodayUsd: async () => 0,
    consumeQuota: async (_u, feature) => ({ release: async () => void released.push(feature) }),
    model: () => "claude-haiku-5-5",
    ...extra,
  });
}
const reply = (parsed: unknown, usage = { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0 }): ModelReply => ({
  parsed,
  stopReason: "end_turn",
  usage,
});
const call = (validate?: (o: { pick: string }) => string[]) =>
  runAi({ unit: "planner", userId: "u1", requestId: "req_1", schema: Out, system: "s", content: [{ type: "text", text: "c" }], validate });

afterEach(() => __resetAiDeps());

describe("runAi", () => {
  it("returns a valid output with terminated done and writes one run record", async () => {
    setup([reply({ pick: "set_1" })]);
    const { output, run } = await call();
    expect(output).toEqual({ pick: "set_1" });
    expect(run.terminated).toBe("done");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ unit: "planner", terminated: "done", repairs: 0, requestId: "req_1" });
  });

  it("prices the run from the cost model", async () => {
    setup([reply({ pick: "set_1" }, { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0 })], {
      spentTodayUsd: async () => 0,
    });
    // One million input tokens at the default model's price is above the planner budget: the run is capped.
    await expect(call()).rejects.toMatchObject({ status: 502, code: "budget_exceeded" });
    expect(records[0].costUsd).toBeCloseTo(targets.costModel.usdPerMillionTokens["claude-haiku-5-5"].input, 6);
    expect(records[0].terminated).toBe("cap");
  });

  it("repairs once when validation fails, then succeeds", async () => {
    setup([reply({ pick: "bad" }), reply({ pick: "set_2" })]);
    const { output } = await call((o) => (o.pick.startsWith("set_") ? [] : [`pick ${o.pick} is not a candidate`]));
    expect(output.pick).toBe("set_2");
    expect(records[0].repairs).toBe(1);
    expect(records[0].steps.some((s) => !s.ok && s.error?.includes("not a candidate"))).toBe(true);
  });

  it("fails with 502 model_error and terminated error after exhausting repairs", async () => {
    setup([reply({ wrong: true })]);
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, code: "model_error" });
    expect(records[0].terminated).toBe("error");
    expect(records[0].repairs).toBe(targets.budgets.planner.maxRepairs);
  });

  it("surfaces a provider failure as 502 model_error, never a fallback answer", async () => {
    setup([new Error("connection reset")]);
    await expect(call()).rejects.toMatchObject({ status: 502, code: "model_error" });
    expect(records[0].steps.find((s) => !s.ok)?.error).toContain("connection reset");
  });

  it("maps a refusal to 422 ai_refused", async () => {
    setup([{ parsed: null, stopReason: "refusal", usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0 } }]);
    await expect(call()).rejects.toMatchObject({ status: 422, code: "ai_refused" });
  });

  it("refuses to call the model past the team's daily spend cap", async () => {
    let called = false;
    setup([reply({ pick: "set_1" })], {
      spentTodayUsd: async () => targets.limits.globalDailySpendCapUsd,
      transport: async () => {
        called = true;
        return reply({ pick: "set_1" });
      },
    });
    await expect(call()).rejects.toMatchObject({ status: 503, code: "ai_paused" });
    expect(called).toBe(false);
  });

  it("gives the quota back when the run fails", async () => {
    setup([new Error("connection reset")]);
    await expect(call()).rejects.toMatchObject({ status: 502 });
    expect(released).toEqual(["plans"]);
  });

  it("keeps the quota spent when the run succeeds", async () => {
    setup([reply({ pick: "set_1" })]);
    await call();
    expect(released).toEqual([]);
  });

  it("checks the team spend cap before spending the user's quota", async () => {
    let consumed = false;
    setup([reply({ pick: "set_1" })], {
      spentTodayUsd: async () => targets.limits.globalDailySpendCapUsd,
      consumeQuota: async () => {
        consumed = true;
        return { release: async () => {} };
      },
    });
    await expect(call()).rejects.toMatchObject({ status: 503, code: "ai_paused" });
    expect(consumed).toBe(false);
  });

  it("consumes the unit's quota before calling the model", async () => {
    const order: string[] = [];
    setup([reply({ pick: "set_1" })], {
      consumeQuota: async (_u, feature) => {
        order.push(`quota:${feature}`);
        return { release: async () => {} };
      },
      transport: async () => {
        order.push("model");
        return reply({ pick: "set_1" });
      },
    });
    await call();
    expect(order).toEqual(["quota:plans", "model"]);
  });

  it("does not call the model when the quota is exhausted", async () => {
    let called = false;
    setup([reply({ pick: "set_1" })], {
      consumeQuota: async () => {
        throw new ApiError(429, "quota_exhausted", "Quota exhausted", "2026-10-21");
      },
      transport: async () => {
        called = true;
        return reply({ pick: "set_1" });
      },
    });
    await expect(call()).rejects.toMatchObject({ status: 429 });
    expect(called).toBe(false);
  });
});
