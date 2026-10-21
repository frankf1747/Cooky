// The receipts eval runner (eval/README.md, SPEC §13): `npm run eval -- receipts`.
// Each case's photo goes through the same pipeline users get (extract.ts: receipt_reader through
// the gateway, then code classifies the lines); eval-score.ts compares the draft with the
// hand-written answer. Results go to eval/runs/ (gitignored). Nothing is stored in receipts or
// the fridge. Runs are recorded in `runs` like any other, so their cost counts toward the team cap.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import targets from "@spec/targets.json";
import { ApiError } from "@/platform/errors";
import type { RunInfo } from "@spec/contract";
import { aggregate, ReceiptCase, scoreCase, type CaseResult, type RunStats } from "./eval-score";

const CASES = "eval/smoke/receipts/cases.json";

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
const fmt = (key: string, v: number | null) =>
  v === null ? "n/a" : key.includes("_ms") ? `${Math.round(v)} ms` : key.includes("usd") ? `$${v.toFixed(4)}` : pct(v);

export async function runReceiptsEval(casesPath = CASES): Promise<number> {
  // npm scripts load no env file; use .env.local unless the caller already set one (with-env.mjs).
  if (!process.env.SUPABASE_SECRET_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");

  const cases = z.array(ReceiptCase).parse(JSON.parse(readFileSync(casesPath, "utf8")));
  if (cases.length === 0) {
    console.log(`eval receipts: ${casesPath} has no cases yet. Data & Proof adds them (format: eval/README.md).`);
    return 1;
  }
  const wanted = targets.workload.smokeSets.receipts;
  if (cases.length < wanted) console.log(`eval receipts: ${cases.length} cases; the smoke set calls for ${wanted}.`);

  // Imported here so the env file above is loaded before config is read.
  const { config } = await import("@/platform/config");
  const { systemWriter } = await import("@/platform/db");
  const { DEFAULT_TIMEZONE, localDate } = await import("@/platform/dates");
  const { __setAiDeps } = await import("@/platform/ai");
  const { extractReceipt } = await import("./extract");
  const { sniffImage } = await import("./image");
  const { loadCatalog } = await import("./store");

  const live = config().aiMode === "live";
  if (!live) console.log("eval receipts: AI is in FAKE mode (no ANTHROPIC_API_KEY or AI_MODE=fake). Every case gets the same fixture; the numbers below test the runner, not the model.");

  // Runs are recorded against a real user: the local test account (E2E_TEST_EMAIL).
  const db = systemWriter();
  const email = process.env.E2E_TEST_EMAIL;
  if (!email) throw new Error("eval receipts: set E2E_TEST_EMAIL to a signed-up account (see .env.example)");
  const { data: users, error } = await db.auth.admin.listUsers();
  if (error) throw new Error(`eval receipts: listing users failed: ${error.message}`);
  const userId = users.users.find((u) => u.email === email)?.id;
  if (!userId) throw new Error(`eval receipts: no account for E2E_TEST_EMAIL on ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  // The eval must not use up the test account's daily receipt quota; everything else (model,
  // repairs, budgets, team spend cap, run records) is the gateway's real behaviour.
  __setAiDeps({ consumeQuota: async () => ({ release: async () => {} }) });

  const catalog = await loadCatalog(db, userId);
  const today = localDate(DEFAULT_TIMEZONE);
  const results: { result: CaseResult; run: RunStats; runId: string | null; error?: string }[] = [];

  for (const [i, c] of cases.entries()) {
    const label = `${String(i + 1).padStart(2)}/${cases.length} ${c.image}`;
    if (!existsSync(c.image)) throw new Error(`eval receipts: ${c.image} not found`);
    const image = new Uint8Array(readFileSync(c.image));
    const mediaType = sniffImage(image);
    if (!mediaType) throw new Error(`eval receipts: ${c.image} is not a JPEG, PNG or WebP`);

    const started = Date.now();
    try {
      const out = await extractReceipt({ userId, requestId: `eval_receipts_${i + 1}`, image, mediaType, catalog, today });
      const result = scoreCase(c, out);
      results.push({ result, run: { ms: Date.now() - started, costUsd: out.run.costUsd, ok: true }, runId: out.run.runId });
      console.log(`${label}  ${c.notReceipt ? `not-a-receipt ${result.notReceiptHandled ? "ok" : "MISSED"}` : `found ${result.foundFood}/${result.expectedFood} food · accepted ${result.acceptedCorrect}/${result.accepted} correct · flagged ${result.flagged}/${result.draftFood}`}`);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const run = err.extra?.run as RunInfo | undefined;
      // A failed read stocks nothing: every food line on that receipt counts as not found.
      const result = scoreCase(c, { isReceipt: true, lines: [] });
      results.push({ result, run: { ms: Date.now() - started, costUsd: run?.costUsd ?? 0, ok: false }, runId: run?.runId ?? null, error: `${err.status} ${err.code}` });
      console.log(`${label}  FAILED ${err.status} ${err.code}`);
    }
  }

  const summary = aggregate(results);
  console.log("");
  for (const ch of summary.checks) {
    console.log(`${ch.pass ? "pass" : "FAIL"}  ${ch.key.padEnd(36)} ${fmt(ch.key, ch.value).padStart(10)}   target ${fmt(ch.key, ch.target)}`);
  }
  if (summary.notReceiptsHandled !== "0/0") console.log(`      non-receipts rejected                ${summary.notReceiptsHandled.padStart(10)}`);
  const mistakes = results.flatMap((r) => r.result.mistakes.map((m) => `${r.result.image}: "${m.raw}" (${m.why})`));
  if (mistakes.length) console.log(`\nwrong auto-accepted lines:\n  ${mistakes.join("\n  ")}`);

  mkdirSync("eval/runs", { recursive: true });
  const file = `eval/runs/receipts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ set: "receipts", mode: live ? "live" : "fake", model: config().models.receipt_reader, cases: results, ...summary }, null, 2));
  console.log(`\neval receipts: ${summary.pass && live ? "PASS" : "FAIL"}${live ? "" : " (fake mode never passes)"} · report ${file}`);
  return summary.pass && live ? 0 : 1;
}
