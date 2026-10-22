import { describe, expect, it } from "vitest";
import type { Chunk } from "@spec/contract";
import { matchesQuery, namedStep, nearMatch, rankChunks, stems } from "./retrieval";

const c = (id: string, kind: Chunk["kind"], stepNo: number | null, label: string, text: string): Chunk => ({
  id, recipeId: "rcp_x", kind, stepNo, label, text, timerSeconds: null,
});
const chunks: Chunk[] = [
  c("chk_x_s1", "step", 1, "Step 1", "Scramble the eggs in a hot oiled skillet until just set."),
  c("chk_x_s2", "step", 2, "Step 2", "Add the cold cooked rice and the peas. Let it fry without stirring."),
  c("chk_x_t2", "tip", 2, "Tip", "Slice the scallions before you start."),
  c("chk_x_f1", "faq", null, "FAQ: no wok", "A wide skillet works. Cook in two batches."),
  c("chk_x_f2", "faq", null, "FAQ: freshly cooked rice", "Fresh rice turns mushy. Chill it first."),
];

describe("stems", () => {
  it("lowercases, drops stop words and folds simple plurals and -ing", () => {
    expect(stems("I don't have a WOK")).toEqual(["don", "have", "wok"]);
    expect(stems("tomatoes eggs sticking")).toEqual(["tomato", "egg", "stick"]);
  });
});

describe("namedStep", () => {
  it("finds a step named in the question", () => {
    expect(namedStep("what do I do in step 2?")).toBe(2);
    expect(namedStep("the 3rd step is confusing")).toBe(3);
    expect(namedStep("no wok")).toBeNull();
  });
});

describe("rankChunks (ASK2)", () => {
  it("ranks the FAQ whose label matches first", () => {
    expect(rankChunks(chunks, "I don't have a wok", 5).map((x) => x.id)[0]).toBe("chk_x_f1");
  });
  it("boosts a named step and its tip", () => {
    const ids = rankChunks(chunks, "what happens in step 2?", 5).map((x) => x.id);
    expect(ids.slice(0, 2)).toEqual(["chk_x_s2", "chk_x_t2"]);
  });
  it("returns nothing when the recipe shares no words with the question (not covered)", () => {
    expect(rankChunks(chunks, "Can I use an air fryer?", 5)).toEqual([]);
  });
  it("keeps at most topK", () => {
    expect(rankChunks(chunks, "rice skillet eggs scallions wok", 2)).toHaveLength(2);
  });
});

describe("matchesQuery (RCP3)", () => {
  it("needs every word somewhere in the haystack", () => {
    expect(matchesQuery("chicken rice", ["Ginger soy chicken", "rice-bowl", "Jasmine rice (uncooked)"])).toBe(true);
    expect(matchesQuery("chicken beef", ["Ginger soy chicken"])).toBe(false);
    expect(matchesQuery(undefined, [])).toBe(true);
  });
});

describe("typo tolerance", () => {
  it("matches words of 5+ letters one edit apart, never short words", () => {
    expect(nearMatch("soicy", "spicy")).toBe(true);
    expect(nearMatch("tomatos", "tomato")).toBe(true);
    expect(nearMatch("scalion", "scallion")).toBe(true);
    expect(nearMatch("rice", "ride")).toBe(false);
    expect(nearMatch("spicy", "spice")).toBe(true);
    expect(nearMatch("sticky", "stuck")).toBe(false);
  });
  it("finds the FAQ despite a typo in the question", () => {
    const faq = [c("chk_x_f9", "faq", null, "FAQ: too spicy", "Add more coconut milk.")];
    expect(rankChunks(faq, "i want less soicy what to do", 5).map((x) => x.id)).toEqual(["chk_x_f9"]);
  });
});
