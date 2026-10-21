# Cooky: team proposal and plan

*Owner: Frank · 2026-10-20 · Demo day: end of Day 2 (`ASSUMED:` 2026-10-22)*

> **Read this first** (about 10 minutes). It says what we are building, why, what ships for demo
> day, and **what you personally do next**. Detail lives in [`PRD.md`](PRD.md) (the product) and
> [`SPEC.md`](SPEC.md) (every requirement). This builds on the CookRight proposal; the app is now
> called **Cooky**.

## In one minute

People who cook for one or two and shop about once a week waste money and food at every step:
they guess what to buy, buy duplicates, forget what the food was for, and find it spoiled later.
Meal-planning apps stop at the shopping list. Fridge-tracking apps die because typing in every
item is a chore.

**Cooky covers the whole loop and uses AI exactly where the typing is.** You plan meals from what
is already in your fridge and get a shopping list in real package sizes. At home you photograph the
receipt and Cooky stocks a virtual fridge with what you bought and when it will likely go off. The
fridge shows what to cook first, and cook mode answers questions from the recipe itself.

**The one judgement we must get right:** trust the AI's receipt reading too much and the fridge
fills with wrong items; make the user check every line and nobody will log anything. Cooky
auto-accepts what it is sure of, flags only what it is not, and never changes the fridge without
the user's final tap.

## The journey we demo

| Stage | Without Cooky | With Cooky |
|---|---|---|
| Plan | Guessed amounts, duplicates, a surprise total | Meals chosen around your fridge, budget and taste; one list in real packages with exact cost |
| Stock | Groceries vanish into the fridge; nobody types them in | Snap the receipt, review one screen, done; food Cooky doesn't know is stocked by category |
| Cook | "What was this chicken for?" → takeout | The fridge shows what you can cook now, soonest-to-expire first; cook mode answers from the recipe and cites the step |
| Learn | Same mistakes every week | "A bit dry" becomes a preference you confirm; the next plan uses it |

**Five-minute demo script:** sign up → pay $4.99 with a Stripe test card → plan three dinners for
two under a budget with chicken already in the fridge → scan a real receipt, fix one flagged line,
add to fridge → open the fridge, cook the dish that uses the soonest-expiring item, ask the
assistant a question and see its citation → confirm what was used → show one honest failure (a
budget that is too low).

## What ships for demo day, and what doesn't

**Ships (v1):** sign-up and login · Stripe test checkout that unlocks Pro · AI meal planning with an
exact package-sized shopping list · receipt scan → review → fridge · fridge with typical use-by
dates and "cook now" · cook mode with deductions you confirm · cooking assistant with citations ·
meal swap with preference memory (if Day 1 goes well).

**After demo day (v2, the write-up's "next steps"):** recipe import from links · email alerts ·
weekly fridge check · waste stats · the week-long pilot · a smarter planner agent.

**Never:** live store prices, grocery ordering, food-safety or nutrition advice, real payments.

## How it is built (already done)

Frank built a **walking skeleton** on 2026-10-20: a Next.js app on Vercel with Supabase (login,
database, file storage), Claude (Haiku 5.5, cheap) and Stripe in test mode. Every route, database
table, page and module function already exists and answers **"not implemented"**. Your job is to
replace those stubs in **your own folders**; you never need to create routes, tables or install
packages. AI runs in **fake mode** until a key is set, so you can build without spending the
team's small AI budget.

## Who does what

Fill in names at the first stand-up. Each person owns folders and both builds *and* tests them.

| Role | Name | Owns | Day 1 deliverable | Day 2 deliverable |
|---|---|---|---|---|
| **Platform** | Frank | login, onboarding, settings, Stripe/Pro, AI gateway, database, deploy | Live URL; a new user can pay in test mode and becomes Pro | Help the others land; final deploy and keys |
| **Plan & Shop** | Richard | `src/modules/planning`, `src/modules/preferences`, plan and preferences pages | A real AI plan with a correct shopping list on the live URL | Swap a meal; confirmed preferences change the next plan |
| **Recipes & Cook** | ____ | `src/modules/recipes`, `src/modules/cook`, recipe library and cook pages, the catalog CSVs | A large, clean library (well past the placeholders) with search and filters | Cook mode and the cooking coach with citations |
| **Receipts** | Hanson | `src/modules/receipts`, camera and receipt review pages | A real receipt is read, reviewed and stocks the fridge on the live URL | Plan diff, retries, accuracy on the receipt test set |
| **Fridge** | Una | `src/modules/fridge`, the fridge page | The fridge ledger and fridge page with use-by dates | Cook now, cooking deductions and leftovers, use-soon |
| **Data & Proof** | ____ | test cases, write-up, slides, classmate test; seed rows by PR | Real prices, shelf life and receipt photos with hand-checked answers | Test results, write-up, slides, demo rehearsal |

How the data moves between these roles, the rules that keep it aligned, and what each role can
grow into: **[ROLES.md](ROLES.md)**. Read it before you start.

## What you do in your first hour

### Everyone who codes
1. Get access to the GitHub repo from Frank, then clone it.
2. Install Node 22 (`nvm install 22`) and Docker Desktop, and start Docker.
3. Follow **Start here** in the [README](../README.md): `npm install`, `npx supabase start`,
   fill `.env.local`, `npm run seed`, `npm run dev`.
4. Sign up at http://localhost:3000/signup, then give yourself Pro locally:
   `npm run dev:grant-pro -- you@example.com` (works only on your local database).
   The **shared live database** is already set up; you only need it to test against real
   shared data (`npm run dev:hosted`, secret key from Frank privately; see TECHNICAL).
5. Read [`SPEC.md`](SPEC.md) §0 (what ships) and your section below. Your requirement IDs
   (like `RCT4`) are your to-do list.
6. Open Claude Code in the repo. It reads `AGENTS.md` automatically. Start with:
   *"Use the cooky-module skill. I own <your role>. Implement `<module.function>` for SPEC
   `<IDs>`, test first."*
7. **Never commit to `main`.** Work on a branch (`<area>/<topic>`), open a pull request with
   `gh pr create`, and get one teammate's approval. Before opening it, run
   `npm run gate -- --upto 2 --base-url http://localhost:3000`. The full rules are in
   AGENTS.md ("Git workflow"), which your coding agent follows.

### Plan & Shop
- Start with **shopping math**, no AI: `src/modules/planning/shopping.ts` with tests, using the
  exact example in SPEC PLN3 (need 700 g, have 200 g, 400 g packs at 500 cents → 2 packs, 1000
  cents, 300 g left). Then feasible sets (PLN2), then `createPlan` calling `runAi` with
  `unit: "planner"` (PLN5), then the `/plan` and `/plan/[id]` pages.
- Ask Data & Proof for the `eval/smoke/calc` cases early; they are your answer key.

### Recipes & Cook
- Day 1 morning, with Data & Proof: grow `supabase/seed/*.csv` well past the three placeholder
  recipes (at least `workload.smokeSets.seedRecipes` in `spec/targets.json`), every ingredient
  with a base unit, category, receipt aliases, a dated price and shelf life. `npm run seed`, then
  `npm run check:contract`.
- Then `recipes.list` with search and filters, `recipes.get`, `recipes.listIngredients`, and the
  library and recipe pages: this is what step 3 chooses from.
- Day 2: cook mode (CK1), `cook.done` / `cook.confirm` using Fridge's `proposeDeductions` and
  `applyBatch`, then the coach: `retrieveChunks` and `cook.ask` with citation checks (ASK2–ASK4),
  plus a prep tip and FAQs per recipe.

### Receipts
- Agree with Recipes & Cook on aliases and categories, and with Fridge on the `NewFridgeItem`
  fields you will send (see the handoffs table in ROLES.md).
- Camera / upload page and storage first, then `runAi` with `unit: "receipt_reader"` on Data &
  Proof's real receipt photos, then the decision rule in code (RCT4, RCT10), the review page, and
  `receipts.confirm` → `fridge.applyBatch` with key `rct:<receiptId>`.

### Fridge
- `fridge.applyBatch` first (it wraps the database function `apply_inventory_batch`, already
  built and tested): Receipts and Recipes & Cook both depend on it. Then `view`, `addItem`,
  `updateItem` and the fridge page (doors, shelves, use-by badges).
- Day 2: `cookNow`, `expiringSoon`, `proposeDeductions`, and the Cook now plates.

### Data & Proof (no coding needed)
- **Tonight / Day 1 morning:** with Recipes & Cook, replace the placeholder rows in
  `supabase/seed/*.csv` (open them in a spreadsheet; the column rules are in
  `supabase/seed/README.md`; send changes as a pull request to Recipes & Cook). Sizes for v1 are
  `workload.smokeSets` in `spec/targets.json` (today: 12 recipes, about 40 ingredients). Prices
  from one Los Angeles store with the date you checked; shelf life from a named source such as
  USDA FoodKeeper.
- Photograph real grocery receipts (cover card numbers and loyalty ids) and write, by hand, what
  each line should become: [`eval/README.md`](../eval/README.md) has the format for every test set.
- Write the hand-checked shopping-math answers, plan scenarios and cook questions the same way.
- **Day 2:** run the classmate test (3–5 people, 10 minutes each: time them, note confusions),
  collect results, draft the 4–5 page write-up and the slides, and run two demo rehearsals.

### Platform (Frank)
- **Tonight:** push the repo; create the Supabase project, Vercel project and Stripe test price
  and webhook (steps in [`TECHNICAL.md`](TECHNICAL.md), "Build order"); share access.
- **Day 1:** onboarding and settings, Stripe checkout and webhook, `/api/me`; review every pull
  request that touches shared files.

## Timeline

| When | What | Done when |
|---|---|---|
| Day 0 (tonight) | Repo pushed, accounts created, everyone set up locally; data work starts | everyone sees the "not implemented" pages on their machine |
| Day 1 morning | Fridge, shopping math, recipe pages, billing, in parallel | each owner's first function passes its tests |
| Day 1 afternoon | Planner and receipt scan with the real model | both work on the live URL |
| **Day 1 evening gate** | A new account on the live URL: sign up → pay → plan → save → scan a receipt → fridge | shown live to the team, not described |
| Day 2 morning | Cook deductions, cook now, assistant; swap and preferences if the gate passed | each works on the live URL |
| Day 2 midday | **Feature freeze.** Tests, billing and access checks, classmate test; fix blockers only | results saved |
| Day 2 afternoon | Write-up, slides, rehearse twice from a fresh account | uploaded |

## How we work

- **Stay in your folders.** Need a new field, route, table or package? Ask Frank; don't add it
  yourself. That is what keeps five people from breaking each other.
- **Merge small and often** to `main`, which must always run. A change is "done" when someone else
  ran the checks and saw them pass.
- **Stuck for 45 minutes?** Say so in the group chat with what you tried.
- **Two short check-ins a day:** morning (blockers) and evening (show it running).
- **Honest over impressive:** if something doesn't work, the app says so and the write-up says
  so. No fake results, no invented numbers.
- **If we fall behind**, cut in this order: swap and preferences → leftovers → cooking assistant →
  onboarding extras. Never cut: login, Stripe, the planner, correct shopping math, receipt →
  fridge, the live URL, the write-up.

## Where to read more

[`PRD.md`](PRD.md): the product and why · [`SPEC.md`](SPEC.md): every requirement (§0 scope, §5
your IDs, §14 the plan) · [`TECHNICAL.md`](TECHNICAL.md): setup, deploy, troubleshooting ·
[`../AGENTS.md`](../AGENTS.md): the rules your coding agent follows ·
[`../eval/README.md`](../eval/README.md): test case formats.
