// Owner: Recipes & Cook. Pure ranking for the cooking assistant (SPEC ASK2) and library search
// (RCP3). No database and no model here, so every rule is unit-tested directly.
import type { Chunk } from "@spec/contract";

const STOP = new Set(
  ("a an and are as at be but by can do does for from how i if in into is it its me my no not of on or " +
    "should so than that the then there these this to too was what when where which while who why will " +
    "with without would you your we our use using get make much many any some just".split(" ")),
);

function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (/(s|x|z|ch|sh|o)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Lowercase word stems: "sticking" → "stick", "eggs" → "egg", "tomatoes" → "tomato". Crude on purpose; it only has to match. */
export function stems(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

/** The step a question names explicitly ("step 3", "the 2nd step"), or null. */
export function namedStep(question: string): number | null {
  const m = question.toLowerCase().match(/step\s*#?\s*(\d+)|(\d+)(?:st|nd|rd|th)?\s+step/);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Rank one recipe's chunks for a question (SPEC ASK2): keyword overlap between the question and
 * each chunk's label and text, labels counting double, plus a strong boost for a step (and its
 * tip) named in the question. Chunks that share nothing with the question are dropped, so an
 * empty result means "the recipe doesn't cover that". Ties keep the recipe's own order.
 */
export function rankChunks(chunks: Chunk[], question: string, topK: number): Chunk[] {
  const q = new Set(stems(question));
  const step = namedStep(question);
  const scored = chunks.map((c, i) => {
    const label = new Set(stems(c.label));
    const text = new Set(stems(c.text));
    let score = 0;
    for (const w of q) score += (label.has(w) ? 2 : 0) + (text.has(w) ? 1 : 0);
    if (step !== null && c.stepNo === step && c.kind !== "faq") score += 10;
    return { c, i, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, topK)
    .map((s) => s.c);
}

/** Library text search: every word of the query must appear in the title, a tag or an ingredient name. */
export function matchesQuery(query: string | undefined, haystack: string[]): boolean {
  const words = stems(query ?? "");
  if (!words.length) return true;
  const hay = new Set(haystack.flatMap(stems));
  return words.every((w) => hay.has(w));
}
