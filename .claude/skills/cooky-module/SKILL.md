---
name: cooky-module
description: Use when building or changing a Cooky feature (planning, receipts, fridge, recipes, cook, preferences, billing, account) — implementing a module function, a page, an AI unit, or a test for one. Walks the Cooky way of building a feature so it plugs into the app without breaking other modules.
---

# Building a Cooky feature

Cooky is split by **ownership of files** (AGENTS.md). You build inside one module and its pages.
The skeleton already has every route, table and function signature; your job is to replace
`notImplemented(...)` with real behaviour.

## 1. Find your work
1. Read `docs/SPEC.md` §0. Only rows marked **v1** are in scope.
2. Find your requirement IDs (e.g. `RCT4`) in SPEC §5 and the routes for them in `spec/routes.ts`.
3. Open `src/modules/<your module>/index.ts`. Each exported stub names the route that calls it.
   The route file is already wired; do not edit route files or `spec/contract.ts`.

## 2. Write the test first
- Next to the code: `src/modules/<m>/<thing>.test.ts`. Use exact values from the SPEC
  (e.g. 700 g needed, 200 g in stock, 400 g packs at 500 cents → 2 packs, 1000 cents, 300 g left).
- Run it and watch it fail: `npx vitest run src/modules/<m>`.

## 3. Implement, the Cooky way
- **Shapes** come from `@spec/contract` (zod). Return exactly the contract's response type.
- **Reads**: `await reader()` (RLS applies). **Writes**: `writer(userId).db` with `user_id` set
  from `userId`, never from input. Fridge quantities change only through
  `fridge.applyBatch(...)` (the `apply_inventory_batch` database function).
- **Errors**: throw helpers from `@/platform/errors` (`notFound()`, `conflict(...)`,
  `unprocessable(...)`). Never return a made-up fallback from a `catch`.
- **Numbers** (limits, budgets, quotas): `import targets from "@spec/targets.json"`. Never copy them.
- **Money** is integer cents; unknown price is `null`. **Units** are `g | ml | count`; convert
  with `toBase()` from `@/platform/units`.
- **AI**: call `runAi({ unit, userId, requestId, schema, system, content, validate })` from
  `@/platform/ai`. Put stable instructions in `system`; put user text, images and retrieved
  chunks in `content` inside clearly delimited data blocks. In `validate`, return a violation
  for every id not in the candidates you supplied. The AI returns drafts; only confirm
  endpoints write. Leave `AI_MODE=fake` while building UI; update your unit's fixture in
  `src/platform/ai-fixtures.ts` (ask Platform) if it needs to be smarter.
- **Pages**: replace the `<NotImplemented>` panel. Every screen needs loading, empty, error and
  retry states; disable retry while a request is in flight. Label shelf-life dates as a typical
  guide with their source.

## 4. Prove it
```bash
npm run check && npm run check:contract && npm test
npm run eval -- <your set>                       # once your runner exists
npm run gate -- --upto 2 --base-url http://localhost:3000
```
Then click through your page as a fresh user. Ask the `contract-reviewer` agent to review your
diff, and a reviewer to run the checks before you call it done.

## Stop and ask when
- you need a field, route, table or dependency that does not exist (Platform owns those);
- a target in `spec/targets.json` looks wrong (Data & Proof owns it; never loosen one to pass);
- the change touches a folder another owner holds.
