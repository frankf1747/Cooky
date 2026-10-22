// Owner: Recipes & Cook. Cook mode (CK1–CK3) and the cooking assistant (ASK1–ASK5). Opened from a
// plan as /cook/<recipe>?plan=<plan>&n=<index>, it cooks the plan's dinners in order: the page
// says which dish of how many, and confirming one offers the next.
import { notFound, redirect } from "next/navigation";
import targets from "@spec/targets.json";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import * as cook from "@/modules/cook";
import { getPlan } from "@/modules/planning";
import { CookClient, type CookSequence } from "./CookClient";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** The plan's dinners in order and where this recipe sits in them, or null when cooking one dish. */
async function sequenceFor(userId: string, recipeId: string, planId: string, n: string): Promise<CookSequence | null> {
  if (!planId) return null;
  try {
    const plan = await getPlan(userId, planId);
    const dishes = plan.meals.map((m) => ({ recipeId: m.recipeId, title: m.title }));
    const asked = Number(n);
    const index = Number.isInteger(asked) && dishes[asked]?.recipeId === recipeId ? asked : dishes.findIndex((d) => d.recipeId === recipeId);
    return index < 0 ? null : { planId, index, dishes };
  } catch (err) {
    // A plan that is gone or not yours just means cooking this one dish on its own.
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function CookPage(props: PageProps<"/cook/[recipeId]">) {
  const { recipeId } = await props.params;
  const sp = await props.searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let data: Awaited<ReturnType<typeof cook.pageData>>;
  try {
    data = await cook.pageData(user.id, recipeId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const sequence = await sequenceFor(user.id, recipeId, one(sp.plan), one(sp.n));
  const L = targets.limits;
  return (
    <CookClient
      recipe={data.recipe}
      pro={data.pro}
      defaultServings={data.servings}
      sequence={sequence}
      limits={{ servingsMin: L.servingsMin, servingsMax: L.servingsMax, questionMaxChars: L.cookQuestionMaxChars, feedbackMaxChars: L.feedbackMaxChars }}
    />
  );
}
