// Owner: Recipes & Cook. Library, catalog and retrieval reads (SPEC RCP1–RCP3, ASK2).
// Reads go through the user's session (RLS) and also filter by owner in code (first wall, SPEC §9).
import type { z } from "zod";
import targets from "@spec/targets.json";
import type { Chunk, Ingredient, Recipe, RecipeSummary, RecipesQuery, Unit } from "@spec/contract";
import { reader } from "@/platform/db";
import { notFound, upstream } from "@/platform/errors";
import * as fridge from "@/modules/fridge";
import { matchesQuery, rankChunks } from "./retrieval";

type RecipeRow = {
  id: string;
  owner_id: string | null;
  title: string;
  base_servings: number;
  minutes: number;
  equipment: string[] | null;
  tags: string[] | null;
  source_url: string | null;
  source_label: string;
  image_url: string | null;
};
type RecipeIngredientRow = { recipe_id: string; ingredient_id: string; qty: number | string; unit: Unit; optional: boolean; note: string | null };
type IngredientRow = {
  id: string;
  owner_id: string | null;
  name: string;
  aliases: string[] | null;
  category: Ingredient["category"];
  base_unit: Unit;
  allergen_tags: string[] | null;
  shelf_life_days: Ingredient["shelfLifeDays"] | null;
  shelf_life_source: string | null;
};
type ChunkRow = { id: string; recipe_id: string; kind: Chunk["kind"]; step_no: number | null; label: string; text: string; timer_seconds: number | null };

/** Fail loud: a query error is thrown with its message, never replaced by empty data. */
function rows<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw upstream("db_error", `recipes: loading ${what} failed: ${res.error.message}`);
  return (res.data as T[] | null) ?? [];
}

const visible = (userId: string) => (r: { owner_id: string | null }) => r.owner_id === null || r.owner_id === userId;

function summary(r: RecipeRow): RecipeSummary {
  return {
    id: r.id,
    title: r.title,
    minutes: Number(r.minutes),
    baseServings: Number(r.base_servings),
    tags: r.tags ?? [],
    equipment: r.equipment ?? [],
    custom: r.owner_id !== null,
    imageUrl: r.image_url ?? null,
  };
}

function chunk(c: ChunkRow): Chunk {
  return {
    id: c.id,
    recipeId: c.recipe_id,
    kind: c.kind,
    stepNo: c.step_no ?? null,
    label: c.label,
    text: c.text,
    timerSeconds: c.timer_seconds ?? null,
  };
}

/** Steps in order, each step's prep tip right after it; FAQs keep their seed order. */
function byStep(a: Chunk, b: Chunk): number {
  return (a.stepNo ?? 0) - (b.stepNo ?? 0) || (a.kind === "step" ? -1 : 1) - (b.kind === "step" ? -1 : 1);
}

async function visibleRecipes(userId: string): Promise<RecipeRow[]> {
  const db = await reader();
  const res = await db
    .from("recipes")
    .select("id, owner_id, title, base_servings, minutes, equipment, tags, source_url, source_label, image_url")
    .or(`owner_id.is.null,owner_id.eq.${userId}`);
  return rows<RecipeRow>(res, "recipes").filter(visible(userId));
}

/** GET /api/recipes (RCP3): text search over title, tags and ingredient names; tag; cookable now. */
export async function list(userId: string, query: z.infer<typeof RecipesQuery>): Promise<{ items: RecipeSummary[] }> {
  const recipes = await visibleRecipes(userId);
  const db = await reader();
  const ids = recipes.map((r) => r.id);
  const riRows = ids.length
    ? rows<RecipeIngredientRow>(await db.from("recipe_ingredients").select("recipe_id, ingredient_id").in("recipe_id", ids), "recipe ingredients")
    : [];
  const ingIds = [...new Set(riRows.map((r) => r.ingredient_id))];
  const ingRows = ingIds.length ? rows<{ id: string; name: string }>(await db.from("ingredients").select("id, name").in("id", ingIds), "ingredients") : [];
  const name = new Map(ingRows.map((i) => [i.id, i.name]));

  let items = recipes
    .filter((r) => !query.tag || (r.tags ?? []).includes(query.tag))
    .filter((r) =>
      matchesQuery(query.q, [r.title, ...(r.tags ?? []), ...riRows.filter((ri) => ri.recipe_id === r.id).map((ri) => name.get(ri.ingredient_id) ?? "")]),
    )
    .map(summary)
    .sort((a, b) => a.title.localeCompare(b.title));

  if (query.cookableNow === "true") {
    // Cook now is Fridge's ranking (FRG3): keep its order, and only recipes fully in stock.
    const ranked = await fridge.cookNow(userId);
    const order = new Map(ranked.filter((e) => e.coverage >= 1).map((e, i) => [e.recipeId, i]));
    items = items.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
  return { items };
}

/** GET /api/recipes/{id} (RCP3): one curated or own recipe, else 404. */
export async function get(userId: string, recipeId: string): Promise<Recipe> {
  const db = await reader();
  const recipeRes = await db
    .from("recipes")
    .select("id, owner_id, title, base_servings, minutes, equipment, tags, source_url, source_label, image_url")
    .eq("id", recipeId)
    .maybeSingle();
  if (recipeRes.error) throw upstream("db_error", `recipes: loading recipe failed: ${recipeRes.error.message}`);
  const r = recipeRes.data as RecipeRow | null;
  if (!r || !visible(userId)(r)) throw notFound();

  const [riRes, chunkRes] = await Promise.all([
    db.from("recipe_ingredients").select("recipe_id, ingredient_id, qty, unit, optional, note").eq("recipe_id", recipeId),
    db.from("recipe_chunks").select("id, recipe_id, kind, step_no, label, text, timer_seconds").eq("recipe_id", recipeId),
  ]);
  const riRows = rows<RecipeIngredientRow>(riRes, "recipe ingredients");
  const chunks = rows<ChunkRow>(chunkRes, "recipe chunks").map(chunk);
  const ingIds = riRows.map((ri) => ri.ingredient_id);
  const ingRows = ingIds.length ? rows<{ id: string; name: string }>(await db.from("ingredients").select("id, name").in("id", ingIds), "ingredients") : [];
  const name = new Map(ingRows.map((i) => [i.id, i.name]));

  return {
    ...summary(r),
    ingredients: riRows.map((ri) => ({
      ingredientId: ri.ingredient_id,
      name: name.get(ri.ingredient_id) ?? ri.ingredient_id,
      qty: Number(ri.qty),
      unit: ri.unit,
      optional: ri.optional,
      note: ri.note ?? null,
    })),
    // Tips travel with the steps (CK1 shows a step's prep tip beside it); FAQs on their own.
    steps: chunks.filter((c) => c.kind !== "faq").sort(byStep),
    faqs: chunks.filter((c) => c.kind === "faq"),
    sourceUrl: r.source_url ?? null,
    sourceLabel: r.source_label,
  };
}

/** GET /api/ingredients?q= (RCP2): the catalog plus the user's own custom ingredients. */
export async function listIngredients(userId: string, q: string | undefined): Promise<{ items: Ingredient[] }> {
  const db = await reader();
  const res = await db
    .from("ingredients")
    .select("id, owner_id, name, aliases, category, base_unit, allergen_tags, shelf_life_days, shelf_life_source")
    .or(`owner_id.is.null,owner_id.eq.${userId}`);
  const items = rows<IngredientRow>(res, "ingredients")
    .filter(visible(userId))
    .filter((i) => matchesQuery(q, [i.name, ...(i.aliases ?? [])]))
    .map((i) => ({
      id: i.id,
      name: i.name,
      aliases: i.aliases ?? [],
      category: i.category,
      baseUnit: i.base_unit,
      allergenTags: i.allergen_tags ?? [],
      shelfLifeDays: i.shelf_life_days ?? {},
      shelfLifeSource: i.shelf_life_source ?? "",
      custom: i.owner_id !== null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { items };
}

/**
 * The top chunks of one recipe for a question (SPEC ASK2). Every chunk of the recipe is a
 * candidate (a recipe has a few dozen at most), ranked in code by keyword overlap and any step
 * named in the question; top `limits.retrievalTopK`. Read through the user's session, so a recipe
 * the user cannot see has no chunks. Callers check the recipe exists first.
 */
export async function retrieveChunks(recipeId: string, question: string): Promise<Chunk[]> {
  const db = await reader();
  const res = await db.from("recipe_chunks").select("id, recipe_id, kind, step_no, label, text, timer_seconds").eq("recipe_id", recipeId);
  const chunks = rows<ChunkRow>(res, "recipe chunks").map(chunk).sort((a, b) => (a.kind === "faq" ? 1 : 0) - (b.kind === "faq" ? 1 : 0) || byStep(a, b));
  return rankChunks(chunks, question, targets.limits.retrievalTopK);
}
