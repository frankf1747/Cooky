// Owner: Recipes & Cook. Cook mode (CK1–CK3) and the cooking assistant (ASK1–ASK5).
import { notFound, redirect } from "next/navigation";
import targets from "@spec/targets.json";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import * as cook from "@/modules/cook";
import { CookClient } from "./CookClient";

export default async function CookPage(props: PageProps<"/cook/[recipeId]">) {
  const { recipeId } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let data: Awaited<ReturnType<typeof cook.pageData>>;
  try {
    data = await cook.pageData(user.id, recipeId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const L = targets.limits;
  return (
    <CookClient
      recipe={data.recipe}
      pro={data.pro}
      defaultServings={data.servings}
      limits={{ servingsMin: L.servingsMin, servingsMax: L.servingsMax, questionMaxChars: L.cookQuestionMaxChars, feedbackMaxChars: L.feedbackMaxChars }}
    />
  );
}
