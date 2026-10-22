// Owner: Recipes & Cook. Library, catalog, retrieval for the cooking assistant (SPEC §5.2, ASK2),
// and adding a recipe from words (RCP5 text, RCP6, RCP8).
// Implement in files next to this one and re-export here. Other modules call only what is exported.
import { RecipeExtraction, type RecipeDraft, type RunInfo } from "@spec/contract";
import type { z } from "zod";
import type { ImportRequest, IngredientCreate } from "@spec/contract";
import { runAi } from "@/platform/ai";
import { writer } from "@/platform/db";
import { badRequest, notImplemented, unprocessable, upstream } from "@/platform/errors";
import { newId } from "@/platform/ids";
import { chunksFor, draftProblems, extractionProblems, importerContent, importerSystem, toDraft, type CatalogEntry } from "./importer";
import { listIngredients } from "./library";

export { get, libraryCards, list, listIngredients, perServingCents, retrieveChunks, type LibraryCard } from "./library";

/** How a recipe made from someone's words is credited on its page (pasted or described). */
const FROM_WORDS = "Written with Bao from your words";

/** The ingredients this user can use in a recipe: the catalog plus their own. */
async function catalogFor(userId: string): Promise<CatalogEntry[]> {
  const { items } = await listIngredients(userId, undefined);
  return items.map((i) => ({ id: i.id, name: i.name, aliases: i.aliases, category: i.category, baseUnit: i.baseUnit }));
}

/**
 * POST /api/recipes/import (RCP5, RCP6, RCP7): pasted recipe text or a description of a dish →
 * a draft for the person to review. Never saves. Import from a link or a photo is still v2.
 */
export async function importDraft(userId: string, input: z.infer<typeof ImportRequest>, requestId: string): Promise<{ draft: RecipeDraft; run: RunInfo }> {
  if (input.source.kind !== "text") throw notImplemented(`recipes.importDraft from ${input.source.kind === "url" ? "a link" : "a photo"} (v2)`);
  const catalog = await catalogFor(userId);
  const { output, run } = await runAi({
    unit: "recipe_importer",
    userId,
    requestId,
    schema: RecipeExtraction,
    system: importerSystem(catalog),
    content: importerContent(input.source.text),
    validate: (out) => extractionProblems(out, catalog),
    effort: "low",
  });
  if (!output.isRecipe) throw unprocessable("not_a_recipe", "That doesn't read as a recipe or a dish to cook");
  return { draft: toDraft(output, catalog, FROM_WORDS), run };
}

/**
 * POST /api/recipes (RCP6, RCP8): save a reviewed draft as the user's own recipe, with its
 * ingredients and its step and FAQ chunks. Every row must be a catalog ingredient with an
 * amount in its unit. If a later write fails, the recipe row is removed again so no half
 * recipe is left behind, and the error is returned.
 */
export async function saveImported(userId: string, draft: RecipeDraft): Promise<{ recipeId: string }> {
  const problems = draftProblems(draft, await catalogFor(userId));
  if (problems.length) throw badRequest("invalid_input", problems[0]);

  const recipeId = newId("rcp");
  const { db } = writer(userId);
  const created = await db.from("recipes").insert({
    id: recipeId,
    owner_id: userId,
    title: draft.title.trim(),
    base_servings: draft.baseServings,
    minutes: draft.minutes,
    equipment: draft.equipment,
    tags: draft.tags,
    source_url: draft.sourceUrl,
    source_label: draft.sourceLabel,
    imported_at: new Date().toISOString(),
  });
  if (created.error) throw upstream("db_error", `recipes: saving the recipe failed: ${created.error.message}`);

  const [ingredients, chunks] = await Promise.all([
    db.from("recipe_ingredients").insert(
      draft.ingredients.map((i) => ({ recipe_id: recipeId, ingredient_id: i.ingredientId, qty: i.qty, unit: i.unit, optional: i.optional, note: null })),
    ),
    db.from("recipe_chunks").insert(chunksFor(recipeId, draft)),
  ]);
  const failed = ingredients.error ?? chunks.error;
  if (failed) {
    const undo = await db.from("recipes").delete().eq("id", recipeId).eq("owner_id", userId);
    throw upstream("db_error", `recipes: saving ingredients and steps failed: ${failed.message}${undo.error ? `; removing the half-saved recipe also failed: ${undo.error.message}` : ""}`);
  }
  return { recipeId };
}

// ---- v2
export async function createIngredient(userId: string, input: z.infer<typeof IngredientCreate>): Promise<{ ingredientId: string }> {
  void userId;
  void input;
  throw notImplemented("recipes.createIngredient (v2)");
}
export async function remove(userId: string, recipeId: string): Promise<void> {
  void userId;
  void recipeId;
  throw notImplemented("recipes.remove (v2)");
}
