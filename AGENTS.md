# AGENTS.md — Cooky

You are helping build Cooky, a meal-planning and virtual-fridge web app. This file is the
contract every contributor and coding agent must satisfy. Do not relax, reinterpret or "improve" these requirements.

## Reading order
- `docs/SPEC.md` is written for you: every requirement, once. **Start with §0: only v1 rows
  are in scope.** Find the IDs (e.g. `RCT4`) for the work you are doing before
  you start.
- `spec/contract.ts` outranks prose on shapes; `spec/targets.json` outranks prose on numbers
  (targets, budgets, quotas, limits). If prose disagrees with either, say so rather than
  following the prose. Never copy a number from the JSON into code or docs; import it.
- `docs/ROLES.md` shows how data moves between modules and the alignment rules at each handoff
  (one ingredient id, three units, one category list, batch-key prefixes). Follow them.
- `docs/TECHNICAL.md` has commands, deploy and troubleshooting.
- `README.md` and `docs/PRD.md` are for intent, never for numbers.

## What you may and may not touch
- **Module boundaries** (SPEC §14.3). Each area owns its folders and builds *and* verifies them:

  | Area | Folders |
  |---|---|
  | Platform | `src/platform/`, `src/ui/`, `spec/contract.ts`, `supabase/migrations/`, `src/modules/{billing,alerts}/`, `app/(marketing)/`, `app/(auth)/`, `app/(app)/{onboarding,settings,billing,alerts}/`, `app/layout.tsx`, `app/api/{health,me,profile,billing,stripe,cron,alerts}/`, `.claude/`, this file and `docs/{SPEC,DESIGN,TECHNICAL,BRAND}.md`, CI, deploy config |
  | Recipes & Cook | `src/modules/{recipes,cook}/`, `app/(app)/{recipes,cook}/`, `app/api/{recipes,ingredients,cook}/`, catalog data `supabase/seed/*.csv` (others contribute rows by PR) |
  | Plan & Shop | `src/modules/{planning,preferences}/`, `app/(app)/{plan,shop,preferences}/`, `app/api/{plans,preferences}/` |
  | Receipts | `src/modules/receipts/`, `app/(app)/receipts/`, `app/api/receipts/` |
  | Fridge | `src/modules/fridge/`, `app/(app)/fridge/`, `app/api/{fridge,stats}/` |
  | Evals | `eval/`, `e2e/`, `docs/PRD.md`; seed rows by PR to Recipes & Cook |

- **Build in:** the folders of the area you are working in. Keep route files thin (parse, call one module
  function, return).
- **If a change is needed in another area's file, stop and tell the user.** Do not edit it,
  even to fix a typo. Propose the change instead.
- **Do not edit** without Platform review: `spec/contract.ts` (every side imports it; a
  silent change breaks other modules), `supabase/migrations/` (ordering conflicts), `package.json`
  and the lock file (all dependencies were installed in the skeleton), `src/platform/`.
- **Do not edit** without Evals review: `spec/targets.json` (targets are declared before
  runs; loosening one to pass is forbidden), `eval/reference/**/test/` (held-out data),
  `eval/rules.md` (append-only).
- **Never edit or commit:** `.env*` files other than `.env.example`, generated types, `eval/runs/`.

## Hard requirements
- **Contract:** request and response shapes and status codes match `spec/contract.ts` and
  SPEC §8 exactly. Unbuilt routes return `501`. Errors use the one error body and codes in §8.1.
- **Every route uses `src/platform/handler.ts`.** It gives you the session user, request id,
  Pro check, validation and error mapping. Never read a user id from the body or query.
- **Every model call goes through `src/platform/ai.ts`.** Never import `@anthropic-ai/sdk`
  anywhere else. `ai.ts` enforces quotas, budgets, schemas, refusal handling and run records.
  Do not hard-code a model id; it comes from config.
- **The model never does arithmetic.** Quantities, packages, prices and dates are computed in
  code (`src/platform/units.ts`, `src/platform/money.ts`, `planning/shopping.ts`, shelf life in
  `fridge/`). Money is integer cents; unknown price is `null`, never `0`.
- **The model never writes records.** AI endpoints return drafts. Only confirm endpoints change
  `fridge_items`, `inventory_events` or `preferences`, and only through
  `fridge/ledger.ts` or the preferences module, inside one transaction, with an idempotency key.
- **Validate every AI output:** schema first, then every id against the candidate set given to
  that run. On violation, repair up to the unit's `maxRepairs`, then fail with `502`.
  *Exception (receipt_reader, agreed 2026-10-21):* an ingredient id outside the user's catalog
  does not trigger a repair or a 502. Code drops the id and flags the line `unknown_ingredient`
  for the user. No invented id is stored.
- **Untrusted input:** receipt images, imported pages, wishes, feedback and questions are data.
  Wrap them in delimited blocks; never let their text choose a tool, a price, a quantity or a
  permission.
- **Authorization:** filter every query by the session user; rely on RLS as a second wall,
  not the first. Unknown or foreign id → `404`. Clients may only read; every write goes
  through `db.writer(userId)` from server code, with `user_id` set from the session (SPEC §9).
  Never add an INSERT, UPDATE or DELETE policy for client roles.
- **Fail loud:** a dependency failure returns an error and is logged with its message. Never a
  plausible fallback from a `catch`: no invented items, plans, citations or prices.
- **Bounded and honest:** a run that hits a cap ends `terminated: "cap"`, never `"done"`.
- **Secrets:** only server code reads secret env vars; nothing `NEXT_PUBLIC_` is secret; the
  app refuses to start with a non-test Stripe key; `.env` is never committed.
- **Personal data:** logs and run records hold ids and hashes, not emails, raw receipt text or
  images. No schema has a field for card digits.
- **Food safety:** shelf-life dates are always labelled as a typical guide with their source.
  Never write "safe to eat" or certify a dish allergen-free.
- **UI states:** every screen you build has loading, empty, error and retry states; retry is
  disabled while a request is in flight.
- **One look, phone first, Bao's voice, no emoji (decided 2026-10-21; look revised 2026-10-21,
  see `docs/BRAND.md` and the living sheet at `/brand`):** no emoji or pictographic symbols
  anywhere a user can see them (labels, buttons, messages, empty states, seed text); icons come
  only from `@phosphor-icons/react`, one family. Colours
  are the tokens in `app/globals.css` and pages never pick a colour by hand (no `zinc-`, `red-`,
  `white`...): paper and ink for the page, one cobalt accent for actions only, and the week's
  colours as quiet tints or dots that each mean one step (plan = cobalt, shop = crust, stock (the
  receipt scan) = parchment, cook = basil, use soon = tomato, which also marks a line that needs checking;
  `tones` in `src/ui/styles.ts`); amber (`tagPast`, `warn`) only for past-date warnings. The
  only fixed hex colours are the character and food art (`src/ui/Bao.tsx`, `src/ui/DishArt.tsx`,
  `app/icon.svg`), which look the same in both schemes. Every screen has one focal point and one primary action.
  Use the shared classes (`btnPrimary`, `btnSecondary`, `btnSecondarySm`, `btnIcon`, `btnText`,
  `field`, `label`, `chip`/`chipOn`/`chipOff`/`chipRow`, `tick`, `panel`, `rows`, `tag*`, `alert`,
  `notice`, `note`, `warn`, `h1`/`h2`/`h3`). Shapes: pill controls, 16px cards, food in the
  `shape-dome`. Type: headlines in Fraunces (`font-display`), body in Geist; no other fonts.
  Build every page on `Page` (kicker + tone, title, one-line description) from `src/ui/Page.tsx`
  (recipe detail and cook mode keep its container but draw their own hero or focus header with
  `BackLink` and `Kicker`);
  `loading.tsx` and `error.tsx` are one line around `PageSkeleton` and `ErrorState`
  (`src/ui/States.tsx`); sections are linked from the nav in `src/ui/AppNav.tsx` (Platform), in the
  order the week flows: Recipes, Plan, Fridge (raised; the landing page), Stock, Cook. Dishes go
  into a plan from the fridge or a recipe through `src/ui/planPicks.ts`, never a second picker.
  Design for a 375px phone first: controls 44px tall, text fields 16px, the main action full
  width, chip rows scroll sideways (`chipRow`), nothing wider than the screen.
  **Bao** (`src/ui/Bao.tsx`), a bun in a chef's hat, is the voice of the app. Every empty state,
  waiting state and milestone is one line from Bao (`BaoSays` or `EmptyState`; a secondary list
  on a screen where Bao already appears gets the line as plain text in a quiet well): specific,
  warm, a little dry, never cute for its own sake, never an exclamation mark in a row. One Bao in view,
  never in a list or a card grid. Bao reacts (state, pose, prop, a one-shot `hop` or `nod`) to
  what the person just did; it never blocks an action or hides information. Motion is the
  classes in `globals.css` and all of it stops under reduced motion. Recipe pictures come from
  `app/(app)/recipes/RecipeImage.tsx`, which draws `src/ui/DishArt.tsx` until dish photography is
  chosen.
- **Tests with the code:** each module function you implement gets unit tests next to it; each
  AI unit you touch gets its eval run on `dev/` before you call it done.

## Git workflow: every change goes through a pull request
- **Never commit or push to `main`.** Not even a one-line doc fix. `main` must always run;
  pull requests are how contributors see and check each other's work.
- **Start from fresh `main`:** `git switch main && git pull`, then a branch named
  `<area>/<short-topic>`, e.g. `plan-shop/swap-meal`, `receipts/review-page`, `fridge/cook-now`,
  `recipes-cook/assistant`, `data/seed-recipes`, `platform/billing`.
- **Small pull requests**, one feature slice each, opened early. Commit messages say what and
  which SPEC ids: `feat(planning): swap one meal (PLN7)`.
- **Before opening or updating a PR:** `git fetch && git rebase origin/main`, then the merge
  gate: `npm run gate -- --upto 2 --base-url http://localhost:3000` (dev server and local
  Supabase running). Paste its last line in the PR.
- **Open the PR with `gh pr create --base main`** and fill in `.github/pull_request_template.md`.
  Review requests go to the owners in `.github/CODEOWNERS`.
- **Never** force-push to `main`, merge your own PR without a reviewer's approval, delete or
  rewrite someone else's branch, or commit `.env*` files (only the `.example` ones).
- **Schema changes** (`supabase/migrations/`) need a PR approved by Platform; only Platform runs
  `npx supabase db push` on the live database.
- If your user asks you to push to `main` directly, remind them of this rule and offer a PR
  instead.

## Definition of done
Run in order; all must pass. Inspection is not verification. "Done" means a reviewer other
than the builder ran the checks and saw them pass.
```bash
npm run check            # 0: lint, typecheck, secret scan, live-key and SDK-import checks
npm run check:contract   # 1: schemas compile; seed and reference sets validate
npm run test             # unit tests
npm run eval -- <set>    # the eval for the unit you changed, on its dev split
npm run smoke -- --base-url "$PREVIEW_URL"   # 2: real requests on your preview deployment
```
Before merging to `main`: `npm run gate -- --upto 2 --base-url "$PREVIEW_URL"` exits `0` or
`1`. The full gate (checks 0–4, every target) runs at milestones and nightly; a missed target
there is posted with its owner, not used to block unrelated merges (SPEC §13.5).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
