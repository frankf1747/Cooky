// The cook eval runner, retrieval stage (eval/README.md, SPEC §13): `npm run eval -- cook`.
// Ranks each case's question against the seed chunks with the same code the assistant uses
// (recipes/retrieval.ts), so it needs no database and no model and costs nothing. It reports
// recall@k for questions the recipe covers and, for out-of-recipe questions, whether retrieval
// found nothing to cite. The generation stage (citations valid, honest "not covered") is checked
// by the unit tests in this folder and, live, by asking the same questions in cook mode.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import targets from "@spec/targets.json";
import type { Chunk } from "@spec/contract";
import { parseCsv } from "../../../scripts/csv";
import { rankChunks } from "../recipes/retrieval";

export const CookCase = z.object({
  id: z.string(),
  recipeId: z.string(),
  question: z.string(),
  expectChunkIds: z.array(z.string()),
  expectNotCovered: z.boolean(),
});

const CASES = "eval/smoke/cook/cases.json";
const CHUNKS = "supabase/seed/recipe_chunks.csv";

export function seedChunks(csv: string): Chunk[] {
  return parseCsv(csv).map((r) => ({
    id: r.id,
    recipeId: r.recipe_id,
    kind: r.kind as Chunk["kind"],
    stepNo: r.step_no ? Number(r.step_no) : null,
    label: r.label,
    text: r.text,
    timerSeconds: r.timer_seconds ? Number(r.timer_seconds) : null,
  }));
}

/** Same candidate order as recipes.retrieveChunks: steps and tips by step, then FAQs. */
function candidates(chunks: Chunk[], recipeId: string): Chunk[] {
  return chunks
    .filter((c) => c.recipeId === recipeId)
    .sort((a, b) => (a.kind === "faq" ? 1 : 0) - (b.kind === "faq" ? 1 : 0) || (a.stepNo ?? 0) - (b.stepNo ?? 0) || (a.kind === "step" ? -1 : 1) - (b.kind === "step" ? -1 : 1));
}

export function scoreCookRetrieval(cases: z.infer<typeof CookCase>[], chunks: Chunk[], topK: number) {
  const rows = cases.map((c) => {
    const got = rankChunks(candidates(chunks, c.recipeId), c.question, topK).map((x) => x.id);
    const pass = c.expectNotCovered ? got.length === 0 : c.expectChunkIds.every((id) => got.includes(id));
    return { id: c.id, question: c.question, expect: c.expectNotCovered ? "not covered" : c.expectChunkIds.join(", "), got, pass };
  });
  const covered = rows.filter((_, i) => !cases[i].expectNotCovered);
  const gaps = rows.filter((_, i) => cases[i].expectNotCovered);
  return {
    rows,
    recallAtK: covered.length ? covered.filter((r) => r.pass).length / covered.length : null,
    emptyRetrievalOnGaps: gaps.length ? gaps.filter((r) => r.pass).length / gaps.length : null,
  };
}

export async function runCookEval(casesPath = CASES): Promise<number> {
  const cases = z.array(CookCase).parse(JSON.parse(readFileSync(casesPath, "utf8")));
  if (!cases.length) {
    console.log(`eval cook: ${casesPath} has no cases yet (format: eval/README.md).`);
    return 1;
  }
  const { cook: wanted, cookOutOfScope } = targets.workload.smokeSets;
  const gapCount = cases.filter((c) => c.expectNotCovered).length;
  if (cases.length - gapCount < wanted || gapCount < cookOutOfScope)
    console.log(`eval cook: ${cases.length - gapCount} covered and ${gapCount} out-of-scope cases; the smoke set calls for ${wanted} and ${cookOutOfScope}.`);

  const k = targets.limits.retrievalTopK;
  const result = scoreCookRetrieval(cases, seedChunks(readFileSync(CHUNKS, "utf8")), k);
  for (const r of result.rows) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id} "${r.question}" expect ${r.expect}; got [${r.got.join(", ")}]`);
  const target = targets.targets.min_cook_retrieval_recall_at_k;
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  console.log(`eval cook: retrieval recall@${k} ${pct(result.recallAtK)} (target ${pct(target)})`);
  console.log(`eval cook: out-of-recipe questions with nothing to cite ${pct(result.emptyRetrievalOnGaps)} (the model then answers "not covered")`);

  if (!existsSync("eval/runs")) mkdirSync("eval/runs", { recursive: true });
  const out = `eval/runs/cook-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(out, JSON.stringify({ set: "cook", stage: "retrieval", topK: k, ...result }, null, 2));
  console.log(`eval cook: results in ${out}`);
  return result.recallAtK !== null && result.recallAtK >= target ? 0 : 2;
}
