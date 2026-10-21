import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import targets from "@spec/targets.json";
import { CookCase, scoreCookRetrieval, seedChunks } from "./eval-run";

describe("cook smoke set, retrieval stage, against the real seed chunks", () => {
  it("finds every expected chunk and nothing to cite for out-of-recipe questions", () => {
    const cases = CookCase.array().parse(JSON.parse(readFileSync("eval/smoke/cook/cases.json", "utf8")));
    const chunks = seedChunks(readFileSync("supabase/seed/recipe_chunks.csv", "utf8"));
    const r = scoreCookRetrieval(cases, chunks, targets.limits.retrievalTopK);
    expect(r.rows.filter((x) => !x.pass)).toEqual([]);
    expect(r.recallAtK).toBe(1);
    expect(r.emptyRetrievalOnGaps).toBe(1);
  });
});
