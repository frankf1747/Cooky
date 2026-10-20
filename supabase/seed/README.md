# Seed data (owner: Data & Proof)

The recipe library, ingredient catalog, prices and shelf life Cooky plans with. Edit these CSVs
(in a spreadsheet is fine: export as CSV, UTF-8, keep the header row exactly as documented),
then load them with `npm run seed`. `npm run check:contract` fails if a header drifts from the
column list below.

**The rows shipped with the skeleton are placeholders** so the app runs end to end. Every price
row says `PLACEHOLDER` in `store_label` and every shelf-life row says `PLACEHOLDER` in its
source. Replace them with real data before the demo:

- **Prices:** one Los Angeles store, the date you recorded them, integer cents per package.
- **Shelf life:** a published source (e.g. USDA FoodKeeper), named in the source column. These
  are shown to users as a typical guide, never as safety advice.
- **Recipes:** v1 target size is `workload.smokeSets.seedRecipes` in `spec/targets.json`.

Conventions: ids are lowercase with a prefix (`ing_`, `prd_`, `rcp_`, `chk_`) and never change
once used. Lists inside a cell are separated by `|`. Units are only `g`, `ml` or `count`; if a
recipe amount cannot be expressed in those, leave that recipe out. Empty cell = no value.

### `category_defaults.csv`

Columns: `category,fridge_days,freezer_days,pantry_days,source`

Typical shelf life for food Cooky does not know by name (generic items on receipts). One row per
category: produce, meat, seafood, dairy, eggs, bakery, frozen, pantry, snacks, beverages,
prepared, other.

### `ingredients.csv`

Columns: `id,name,aliases,category,base_unit,allergen_tags,fridge_days,freezer_days,pantry_days,shelf_life_source,plausible_max_qty`

`aliases` are the receipt spellings the reader should recognise (`ORG BNLS CHKN|CHICKEN BREAST`).
`plausible_max_qty` is the largest amount (in `base_unit`) a normal shop would buy; larger
receipt quantities are flagged.

### `products.csv`

Columns: `id,ingredient_id,package_size,unit,price_cents,store_label,region,price_date`

One row per package you can buy. `package_size` is in `unit`, which must equal the ingredient's
`base_unit`. `price_date` is `YYYY-MM-DD`.

### `recipes.csv`

Columns: `id,title,base_servings,minutes,equipment,tags,source_url,source_label`

### `recipe_ingredients.csv`

Columns: `recipe_id,ingredient_id,qty,unit,optional,note`

Quantities are for `base_servings`. `optional` is `true` or `false`.

### `recipe_chunks.csv`

Columns: `id,recipe_id,kind,step_no,label,text`

The cooking assistant answers only from these. `kind` is `step` (with `step_no`, label
`Step N`) or `faq` (no `step_no`, label like `FAQ: no wok`). Write FAQs for the substitutions
and questions a beginner asks; say what does *not* work, too.
