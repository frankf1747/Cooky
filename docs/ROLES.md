# Cooky: data flow and handoffs

How data moves between Cooky's feature modules, and the rules that keep them aligned at each
handoff. The exact shapes live in [`../spec/contract.ts`](../spec/contract.ts) and the tables in
[`SPEC.md`](SPEC.md) §9; if this page and those files ever disagree, the files win.

The modules: **Recipes & Cook** (the catalog, the library, cook mode and the assistant),
**Plan & Shop** (plans, the shopping list, preferences), **Receipts** (receipt photo to confirmed
fridge items), **Fridge** (the ledger, use-soon, Cook now, deductions) and **Platform** (accounts,
billing, the AI gateway, the database, the shared UI).

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

## Data alignment rules

These are where modules break each other. Each rule is enforced by the contract or by a
function that already exists.

1. **One ingredient id everywhere.** `ing_…` from `ingredients` is the only way to name a food
   in recipes, products, shopping lists, receipt lines and fridge items. Never invent an id in
   code. A new food is a new row in `supabase/seed/ingredients.csv`, added by pull request.
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
   - `man:<idempotencyKey>` for manual add (Fridge)
   - `edt:<idempotencyKey>` for one item edit, move, mark used or toss (Fridge, `edit_fridge_item`)
7. **Changing a shared shape** (`spec/contract.ts`), a table or a function another module calls
   is a pull request reviewed by the Platform area **and** the module on the other side of the
   handoff.

## Handoffs

| Between | They agree on | Where it lives |
|---|---|---|
| Recipes & Cook ↔ Receipts | Aliases for receipt spellings, categories, `plausible_max_qty`, new ingredients found on real receipts | `supabase/seed/ingredients.csv` (rows by pull request) |
| Receipts ↔ Fridge | `NewFridgeItem` fields for receipt lines (kind, ingredientId or name + category, qty, unit, location, expiresOn, expirySource, origin `receipt`) | `BatchEvent` in `spec/contract.ts`; `fridge.applyBatch` |
| Receipts ↔ Plan & Shop | Which plan a receipt is compared with, and the plan's shopping items for "you didn't buy garlic" | `planning.getPlan` → `ShoppingList.items[].ingredientId` |
| Fridge ↔ Recipes & Cook | Cook now ranking reads `recipe_ingredients`; cook mode gets deductions from the fridge | `fridge.cookNow`, `fridge.proposeDeductions`, `recipes.get` |
| Fridge ↔ Plan & Shop | "Have" quantities for the shopping list come from the fridge | `fridge.view` → `FridgeItem.qty` by `ingredientId` |
| Every module ↔ evals | Hand-checked test cases for the feature | `eval/smoke/<set>/cases.json` |
