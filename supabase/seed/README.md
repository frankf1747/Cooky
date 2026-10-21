# Seed data (owner: Recipes & Cook; Data & Proof and Receipts contribute rows by pull request)

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

Columns: `id,title,base_servings,minutes,equipment,tags,source_url,source_label,image_url`

`image_url` is optional (https only) and shows on library cards. Tags drive the step-3 filters:
use `quick`, `vegetarian`, `one-pan`, `high-protein` and cuisine names consistently.

### `recipe_ingredients.csv`

Columns: `recipe_id,ingredient_id,qty,unit,optional,note`

Quantities are for `base_servings`. `optional` is `true` or `false`.

### `recipe_chunks.csv`

Columns: `id,recipe_id,kind,step_no,label,text,timer_seconds`

The cooking assistant answers only from these. `kind` is `step` (with `step_no`, label
`Step N`, and `timer_seconds` when the step is timed), `tip` (what to prep while step `step_no`
runs, label `Tip`) or `faq` (no `step_no`, label like `FAQ: no wok`). Write FAQs for the substitutions
and questions a beginner asks; say what does *not* work, too.

## Where the v1 numbers come from (2026-10-21)

- **Prices:** Trader Joe's list prices on traderjoes.com, read on 2026-10-21 (`store_label`
  says so). Prices can differ slightly by store. Two items have no price online, so their rows
  carry the team's estimate and say so in `store_label`: `prd_spinach_170g` ($2.29) and
  `prd_garlic_bulb_10ct` ($0.50 a bulb).
- **Package counts that are estimates:** meat, fish and peppers are sold by weight; the row uses
  the 1 lb list price for a 454 g pack. `prd_lemon_bag_6ct` is a 2 lb bag counted as about 6
  lemons, `prd_scallion_6ct` a 6 oz bunch counted as about 6 scallions, and
  `prd_garlic_bulb_10ct` one bulb counted as about 10 cloves (`ing_garlic` is counted in cloves).
- **Shelf life:** the USDA FSIS FoodKeeper data set (`foodkeeper.json`), item number in each
  `source`, using the shorter end of each range. Milk and sour cream say "package use-by date"
  there; milk uses 7 days as a typical guide and says so.
- **Recipes:** written by the team for this project, so `source_url` is empty and
  `source_label` says so. Quantities are for `base_servings`; rice is uncooked weight.
