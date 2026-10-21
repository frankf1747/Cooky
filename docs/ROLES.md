# Cooky: roles, data flow and handoffs

Read this after [`PROPOSAL.md`](PROPOSAL.md). It shows **how the data moves between roles**, what
each role owns, what it must build for demo day, and where it can grow if there is time. The
exact shapes live in [`../spec/contract.ts`](../spec/contract.ts); the tables in
[`SPEC.md`](SPEC.md) §9. If this page and those files ever disagree, the files win: tell Frank.

## The six roles

| Role | Person | Journey steps | In one line |
|---|---|---|---|
| **Platform** | Frank | 1 set up, 2 unlock Pro | Login, onboarding, Stripe, AI gateway, database, deploy |
| **Recipes & Cook** | ____ | 3 choose (the library), 8 cook | A large, clean recipe library and catalog; cook mode and the cooking assistant |
| **Plan & Shop** | Richard | 3 plan, 4 shop, 9 learn | Picks meals from the library, does the shopping math, remembers preferences |
| **Receipts** | ____ | 5 scan, 6 review | Turns a receipt photo into confirmed fridge items, aligned with the catalog |
| **Fridge** | ____ | 7 fridge, 8–9 deductions | The fridge record: ledger, fridge page, use-soon, Cook now, cooking deductions |
| **Data & Proof** | ____ | all | Real data rows, test cases, results, write-up, slides, demo |

## How the data connects

```
                ┌──────────────── CATALOG (Recipes & Cook) ────────────────┐
                │ ingredients: ing_ id · name · aliases · category ·        │
                │              base_unit · shelf_life_days · max qty        │
                │ products:    package size · price_cents · price_date      │
                │ recipes · recipe_ingredients (qty, unit) · recipe_chunks  │
                │ category_defaults: shelf life for unknown food            │
                └───┬───────────────────┬────────────────────┬─────────────┘
       recipes, products      ingredients, aliases,   recipe_ingredients,
       recipe_ingredients     categories, shelf life  recipe_chunks
                    ▼                   ▼                    ▼
  ┌── Plan & Shop ──────┐   ┌── Receipts ─────────┐   ┌── Fridge ──────────────┐
  │ PlanDraft           │   │ receipt photo       │   │ fridge_items           │
  │ ShoppingList        │──▶│ ReceiptLine[]       │   │ inventory_events       │
  │ (ingredientId,      │   │ (ingredientId or    │   │ FridgeView: items,     │
  │  buyQty, unit)      │   │  category, qty,     │   │ expiringSoon, cookNow  │
  │                     │   │  unit, expiresOn)   │   │                        │
  └──────▲──────────────┘   └─────────┬───────────┘   └───▲────────┬───────────┘
         │ haveQty from FridgeView      │ confirm: BatchEvent[]   │        │
         └──────────────────────────────┼─────── fridge.applyBatch┘        │
                                        │                                  │
          Recipes & Cook: cook.done ──── fridge.proposeDeductions ─────────┘
                          cook.confirm ─ fridge.applyBatch (batch key = cook event id)
                          feedback ───── preferences.propose (Plan & Shop)
```

In words: the **catalog** is the shared dictionary. **Plan & Shop** reads it and the fridge to
build a plan and list. **Receipts** reads the catalog (and the plan, to spot what wasn't bought)
and writes confirmed items into the **fridge** through one function. **Fridge** reads the catalog
to rank what you can cook. **Cook mode** asks the fridge what to deduct and confirms through the
same function.

## Data alignment rules (everyone)

These are where teams break each other. Each rule is enforced by the contract or a function
that already exists.

1. **One ingredient id everywhere.** `ing_…` from `ingredients` is the only way to name a food
   in recipes, products, shopping lists, receipt lines and fridge items. Never invent an id in
   code. A new food is a new row in `supabase/seed/ingredients.csv` (Recipes & Cook owns it),
   added by pull request.
2. **Three units only:** `g`, `ml`, `count`. Each ingredient has one `base_unit`; its products
   and recipe amounts use that unit. Convert printed units with `toBase()` in
   `src/platform/units.ts`. Never convert by hand.
3. **One category list** (`Category` in the contract: produce, meat, seafood, dairy, eggs,
   bakery, frozen, pantry, snacks, beverages, prepared, other) for ingredients, receipt lines,
   generic fridge items and `category_defaults`.
4. **Shelf life has one source:** the ingredient's `shelf_life_days[location]`, else the
   category's default. `expiresOn` = purchase date + days, and `expirySource` says which
   (`table`, `category`, `user`).
5. **Dates** are `YYYY-MM-DD` in the user's timezone. **Money** is integer cents; unknown is
   `null`, never 0.
6. **Every fridge change goes through `fridge.applyBatch(userId, events, batchKey)`** with
   `BatchEvent` / `NewFridgeItem` from the contract. Batch keys are prefixed by who sends them,
   so a key can never collide across features:
   - `rct:<receiptId>` for a receipt confirm (Receipts)
   - the cook event id `cke_…` for a cook confirm (Recipes & Cook)
   - `man:<idempotencyKey>` for manual add, edit and toss (Fridge)
7. **Changing a shared shape** (`spec/contract.ts`), a table or a function another role calls
   is a pull request reviewed by Frank **and** the role on the other side of the handoff.

## Handoffs to agree on Day 1 morning

| Between | They agree on | Where it lives |
|---|---|---|
| Recipes & Cook ↔ Receipts | Aliases for receipt spellings, categories, `plausible_max_qty`, new ingredients found on real receipts | `supabase/seed/ingredients.csv` (Receipts proposes rows by PR; Recipes & Cook merges) |
| Receipts ↔ Fridge | `NewFridgeItem` fields for receipt lines (kind, ingredientId or name + category, qty, unit, location, expiresOn, expirySource, origin `receipt`) | `BatchEvent` in `spec/contract.ts`; `fridge.applyBatch` |
| Receipts ↔ Plan & Shop | Which plan a receipt is compared with, and the plan's shopping items for "you didn't buy garlic" | `planning.getPlan` → `ShoppingList.items[].ingredientId` |
| Fridge ↔ Recipes & Cook | Cook now ranking reads `recipe_ingredients`; cook mode gets deductions from the fridge | `fridge.cookNow`, `fridge.proposeDeductions`, `recipes.get` |
| Fridge ↔ Plan & Shop | "Have" quantities for the shopping list come from the fridge | `fridge.view` → `FridgeItem.qty` by `ingredientId` |
| Everyone ↔ Data & Proof | Hand-checked test cases for your feature | `eval/smoke/<set>/cases.json` |

## Role by role

### Recipes & Cook: the library and the cook
- **Owns:** `src/modules/recipes/`, `src/modules/cook/`, `app/(app)/recipes/`, `app/(app)/cook/`,
  `app/api/{recipes,ingredients,cook}/`, and the catalog data in `supabase/seed/*.csv`
  (Data & Proof and Receipts contribute rows by pull request).
- **Why it matters:** step 3 is only as good as the library. A user should see real choice, not
  three sample dishes, and every recipe must be clean enough for exact shopping math.
- **Build for demo day (v1):**
  1. Grow the catalog well past the placeholders: at least `workload.smokeSets.seedRecipes`
     recipes and `seedIngredients` ingredients (`spec/targets.json`), every ingredient with a
     base unit, category, aliases, a product with a dated price, and shelf life.
  2. `recipes.list` with search and filters (tag, minutes, equipment, cookable now),
     `recipes.get`, `recipes.listIngredients`, and the recipe library and recipe pages.
  3. Cook mode (CK1), `cook.done` / `cook.confirm` using Fridge's functions, then the cooking
     coach: `retrieveChunks` and `cook.ask` with citation checks (ASK1–ASK5), plus prep tips and
     FAQs in `recipe_chunks` for every recipe.
- **Produces:** catalog rows, `Recipe`, `RecipeSummary`, `Chunk`, `CookAnswer`.
- **Consumes:** `fridge.cookNow` / `proposeDeductions` / `applyBatch`; `preferences.propose`.
- **Done when:** the library page lists every seed recipe with filters working, `check:seed`
  passes, and the cook smoke set meets its targets.
- **Can scale:** more cuisines and diets as tags; recipe photos; recipe import from a link or a
  cookbook photo (RCP4–RCP7, already stubbed); users' own recipes; "pin a recipe" in step 3
  (needs a new `mustIncludeRecipeIds` field: agree with Plan & Shop and Frank).

### Receipts: from paper to aligned data
- **Owns:** `src/modules/receipts/`, `app/(app)/receipts/` (camera at `receipts/new`, review at
  `receipts/[id]`), `app/api/receipts/`, `eval/smoke/receipts/` runner (cases from Data & Proof).
- **Why it matters:** this is the core demo feature and the main way food enters the fridge.
  Its job is to turn messy printed lines into the team's exact data: catalog ids, base units,
  categories and dates.
- **Build for demo day (v1):**
  1. Camera / upload page, image downsizing (`limits.receiptImageMaxPx`), private storage at
     `receipts/{userId}/{receiptId}`, deletion after confirm (RCT1, RCT9).
  2. `runAi` with `unit: "receipt_reader"`, given the catalog's ids and aliases; then in code:
     `toBase()` conversion, id validation, shelf life, and the decision rule auto / generic /
     flagged / ignored (RCT2–RCT4, RCT10).
  3. Plan diff against the linked plan (RCT5), the review page, and `receipts.confirm` sending
     `BatchEvent[]` to `fridge.applyBatch` with key `rct:<receiptId>` (RCT6).
  4. Honest failure states and retry (RCT7); injection-proof extraction (RCT8).
- **Produces:** `ReceiptDraft`, `ReceiptLine`, and the `BatchEvent[]` it sends on confirm.
- **Consumes:** catalog `ingredients` (ids, aliases, category, shelf life, max qty),
  `category_defaults`, `planning.getPlan` (for the diff), `fridge.applyBatch`.
- **Done when:** a real receipt stocks the fridge on the live URL, and the receipts smoke set
  meets both `min_receipt_auto_accept_precision` and `max_receipt_flag_rate`.
- **Can scale:** long receipts in parts; store-specific alias learning (propose new aliases
  automatically from confirmed fixes); "spent vs. estimate" using the receipt's real prices;
  learning your store's prices for the next plan; a photo of groceries with no receipt; barcode
  scan.

### Fridge: the record everything else trusts
- **Owns:** `src/modules/fridge/`, `app/(app)/fridge/`, `app/api/fridge/`, `app/api/stats/`.
- **Why it matters:** the fridge record is the product. Plans, Cook now, rescue tips and the
  demo all depend on it matching reality.
- **Build for demo day (v1):**
  1. `fridge.applyBatch` (wraps the tested `apply_inventory_batch` database function), `view`,
     `addItem`, `updateItem` (edit, move to freezer with recomputed date, toss) (FRG1–FRG4).
     `updateItem` calls the tested `edit_fridge_item` database function, which does the whole
     edit in one locked step against `expectedQty` (see docs/TECHNICAL.md, "Fridge writes").
  2. The fridge page from the journey map: doors, shelves, days-left badges, the Use soon list,
     and Cook now plates opening a dish card (FRG3, FRG5).
  3. `cookNow` (ranked by stock coverage, soonest-expiring first), `expiringSoon`, and
     `proposeDeductions` for cook mode (oldest expiry first, never below zero).
- **Produces:** `FridgeItem`, `FridgeView`, `CookNowEntry`, `Deduction`; the ledger in
  `inventory_events`.
- **Consumes:** `BatchEvent[]` from Receipts and Recipes & Cook; catalog `recipe_ingredients`
  and shelf life.
- **Done when:** after the scripted journey (receipt confirm, cook confirm, toss, double taps),
  every fridge quantity matches the ledger (`min_fridge_consistency_rate`).
- **Can scale:** weekly fridge check (FRG6); waste and money-saved stats (FRG7); freezer
  suggestions before expiry; rescue alerts and email together with Platform (ALR1–ALR5);
  shared household fridges.

### Plan & Shop (Richard), Platform (Frank), Data & Proof
Unchanged; see [`PROPOSAL.md`](PROPOSAL.md) and SPEC §14.3. Plan & Shop's step 3 reads the
library through `recipes.list`, so its filters and the catalog's quality are a joint concern
with Recipes & Cook.
