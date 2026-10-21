// Owner: Recipes & Cook. Library, catalog, retrieval for the cooking assistant (SPEC §5.2, ASK2).
// Implement in files next to this one and re-export here. Other modules call only what is exported.
import type { RecipeDraft, RunInfo } from "@spec/contract";
import type { z } from "zod";
import type { ImportRequest, IngredientCreate } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export { get, libraryCards, list, listIngredients, perServingCents, retrieveChunks, type LibraryCard } from "./library";

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
