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

describe("quick questions in cook mode", () => {
  it("each of the four one-tap questions finds its FAQ on every seed recipe", async () => {
    const { rankChunks } = await import("../recipes/retrieval");
    const chunks = seedChunks(readFileSync("supabase/seed/recipe_chunks.csv", "utf8"));
    const quick: [string, RegExp][] = [
      ["Is it done? (I'm on step 2)", /done/],
      ["It's sticking (I'm on step 2)", /stick/],
      ["Short on time (I'm on step 1)", /short/],
      ["Keep it juicy (I'm on step 3)", /juicy|dry/],
    ];
    for (const recipeId of [...new Set(chunks.map((c) => c.recipeId))]) {
      for (const [q, label] of quick) {
        const got = rankChunks(chunks.filter((c) => c.recipeId === recipeId), q, targets.limits.retrievalTopK);
        expect(got.some((c) => c.kind === "faq" && label.test(c.label)), `${recipeId}: ${q}`).toBe(true);
      }
    }
  });
});
