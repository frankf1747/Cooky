// Load supabase/seed/*.csv into the database (upsert by id). Validates every row first and loads
// nothing if any row is wrong. Usage: npm run seed   (reads .env.local; needs SUPABASE_SECRET_KEY)
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Category, Unit } from "../spec/contract";
import { parseCsv } from "./csv";

// ENV_FILE=.env.hosted npm run seed  loads the hosted project instead of local Supabase.
const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

const DIR = "supabase/seed";
const errors: string[] = [];
const read = (f: string) => parseCsv(readFileSync(`${DIR}/${f}`, "utf8"));
const list = (s: string) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);
const int = (s: string) => (s === "" ? undefined : Number.parseInt(s, 10));
const num = (s: string, where: string) => {
  const n = Number(s);
  if (s === "" || !Number.isFinite(n)) errors.push(`${where}: "${s}" is not a number`);
  return n;
};
const days = (r: Record<string, string>) =>
  Object.fromEntries(
    (["fridge", "freezer", "pantry"] as const).flatMap((k) => (int(r[`${k}_days`]) ? [[k, int(r[`${k}_days`])]] : [])),
  );
const check = (ok: boolean, msg: string) => ok || errors.push(msg);

const categories = read("category_defaults.csv").map((r, i) => {
  check(Category.safeParse(r.category).success, `category_defaults.csv row ${i + 2}: unknown category "${r.category}"`);
  return { category: r.category, shelf_life_days: days(r), source: r.source };
});

const ingredients = read("ingredients.csv").map((r, i) => {
  const at = `ingredients.csv row ${i + 2}`;
  check(/^ing_[0-9a-z_]+$/.test(r.id), `${at}: bad id "${r.id}"`);
  check(Category.safeParse(r.category).success, `${at}: unknown category "${r.category}"`);
  check(Unit.safeParse(r.base_unit).success, `${at}: base_unit must be g, ml or count`);
  return {
    id: r.id,
    owner_id: null,
    name: r.name,
    aliases: list(r.aliases),
    category: r.category,
    base_unit: r.base_unit,
    allergen_tags: list(r.allergen_tags),
    shelf_life_days: days(r),
    shelf_life_source: r.shelf_life_source,
    plausible_max_qty: r.plausible_max_qty ? num(r.plausible_max_qty, at) : null,
  };
});
const ingredientUnit = new Map(ingredients.map((x) => [x.id, x.base_unit]));

const products = read("products.csv").map((r, i) => {
  const at = `products.csv row ${i + 2}`;
  check(/^prd_[0-9a-z_]+$/.test(r.id), `${at}: bad id "${r.id}"`);
  check(ingredientUnit.has(r.ingredient_id), `${at}: unknown ingredient ${r.ingredient_id}`);
  check(ingredientUnit.get(r.ingredient_id) === r.unit, `${at}: unit ${r.unit} must equal the ingredient's base_unit`);
  check(Number.isInteger(Number(r.price_cents)), `${at}: price_cents must be integer cents`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(r.price_date), `${at}: price_date must be YYYY-MM-DD`);
  return {
    id: r.id,
    ingredient_id: r.ingredient_id,
    package_size: num(r.package_size, at),
    unit: r.unit,
    price_cents: Number(r.price_cents),
    store_label: r.store_label,
    region: r.region,
    price_date: r.price_date,
  };
});

const recipes = read("recipes.csv").map((r, i) => {
  const at = `recipes.csv row ${i + 2}`;
  check(/^rcp_[0-9a-z_]+$/.test(r.id), `${at}: bad id "${r.id}"`);
  return {
    id: r.id,
    owner_id: null,
    title: r.title,
    base_servings: num(r.base_servings, at),
    minutes: num(r.minutes, at),
    equipment: list(r.equipment),
    tags: list(r.tags),
    source_url: r.source_url || null,
    source_label: r.source_label,
  };
});
const recipeIds = new Set(recipes.map((r) => r.id));

const recipeIngredients = read("recipe_ingredients.csv").map((r, i) => {
  const at = `recipe_ingredients.csv row ${i + 2}`;
  check(recipeIds.has(r.recipe_id), `${at}: unknown recipe ${r.recipe_id}`);
  check(ingredientUnit.has(r.ingredient_id), `${at}: unknown ingredient ${r.ingredient_id}`);
  check(ingredientUnit.get(r.ingredient_id) === r.unit, `${at}: unit ${r.unit} must equal the ingredient's base_unit`);
  check(r.optional === "true" || r.optional === "false", `${at}: optional must be true or false`);
  return { recipe_id: r.recipe_id, ingredient_id: r.ingredient_id, qty: num(r.qty, at), unit: r.unit, optional: r.optional === "true", note: r.note || null };
});

const chunks = read("recipe_chunks.csv").map((r, i) => {
  const at = `recipe_chunks.csv row ${i + 2}`;
  check(/^chk_[0-9a-z_]+$/.test(r.id), `${at}: bad id "${r.id}"`);
  check(recipeIds.has(r.recipe_id), `${at}: unknown recipe ${r.recipe_id}`);
  check(r.kind === "step" || r.kind === "faq", `${at}: kind must be step or faq`);
  check(r.kind === "faq" || Boolean(int(r.step_no)), `${at}: steps need step_no`);
  return { id: r.id, recipe_id: r.recipe_id, kind: r.kind, step_no: int(r.step_no) ?? null, label: r.label, text: r.text };
});

if (errors.length) {
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`seed: ${errors.length} error(s); nothing loaded`);
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.log("seed: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const steps: [string, object[], string][] = [
  ["category_defaults", categories, "category"],
  ["ingredients", ingredients, "id"],
  ["products", products, "id"],
  ["recipes", recipes, "id"],
  ["recipe_ingredients", recipeIngredients, "recipe_id,ingredient_id"],
  ["recipe_chunks", chunks, "id"],
];

async function main() {
  for (const [table, rows, onConflict] of steps) {
    const { error } = await db.from(table).upsert(rows, { onConflict });
    if (error) {
      console.log(`ERROR ${table}: ${error.message}`);
      process.exit(2);
    }
    console.log(`seed: ${table} ${rows.length} rows`);
  }
  console.log("seed: done");
}
void main();
