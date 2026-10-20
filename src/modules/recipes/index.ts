// Owner: Recipes & Cook. Library, catalog, retrieval for the cooking assistant (SPEC §5.2, ASK2).
// Implement in files next to this one and re-export here. Other modules call only what is exported.
import type { Chunk, Ingredient, Recipe, RecipeDraft, RecipeSummary, RunInfo } from "@spec/contract";
import type { z } from "zod";
import type { ImportRequest, IngredientCreate, RecipesQuery } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function list(userId: string, query: z.infer<typeof RecipesQuery>): Promise<{ items: RecipeSummary[] }> {
  void userId;
  void query;
  throw notImplemented("recipes.list");
}

export async function get(userId: string, recipeId: string): Promise<Recipe> {
  void userId;
  void recipeId;
  throw notImplemented("recipes.get");
}

export async function listIngredients(userId: string, q: string | undefined): Promise<{ items: Ingredient[] }> {
  void userId;
  void q;
  throw notImplemented("recipes.listIngredients");
}

/** Join used by cook.ask (SPEC ASK2): the top chunks of one recipe for a question. */
export async function retrieveChunks(recipeId: string, question: string): Promise<Chunk[]> {
  void recipeId;
  void question;
  throw notImplemented("recipes.retrieveChunks");
}

// ---- v2
export async function createIngredient(userId: string, input: z.infer<typeof IngredientCreate>): Promise<{ ingredientId: string }> {
  void userId;
  void input;
  throw notImplemented("recipes.createIngredient (v2)");
}
export async function importDraft(userId: string, input: z.infer<typeof ImportRequest>, requestId: string): Promise<{ draft: RecipeDraft; run: RunInfo }> {
  void userId;
  void input;
  void requestId;
  throw notImplemented("recipes.importDraft (v2)");
}
export async function saveImported(userId: string, draft: RecipeDraft): Promise<{ recipeId: string }> {
  void userId;
  void draft;
  throw notImplemented("recipes.saveImported (v2)");
}
export async function remove(userId: string, recipeId: string): Promise<void> {
  void userId;
  void recipeId;
  throw notImplemented("recipes.remove (v2)");
}
