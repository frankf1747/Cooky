# AGENTS.md — Cooky

You are helping build Cooky, a meal-planning and virtual-fridge web app. This file is the
contract you must satisfy. Do not relax, reinterpret or "improve" these requirements.

## Reading order
- `docs/SPEC.md` is written for you: every requirement, once. **Start with §0: only v1 rows
  are built before demo day.** Find the IDs (e.g. `RCT4`) for the work you are doing before
  you start.
- `spec/contract.ts` outranks prose on shapes; `spec/targets.json` outranks prose on numbers
  (targets, budgets, quotas, limits). If prose disagrees with either, say so rather than
  following the prose. Never copy a number from the JSON into code or docs; import it.
- `docs/TECHNICAL.md` has commands, deploy and troubleshooting.
- `README.md` and `docs/PRD.md` are for intent, never for numbers.

## What you may and may not touch
- **Ownership** (SPEC §14.3). Each person owns folders and builds *and* verifies them:

  | Owner | Folders |
  |---|---|
  | Platform (Frank) | `src/platform/`, `src/ui/`, `spec/contract.ts`, `supabase/migrations/`, `src/modules/{billing,alerts}/`, `app/(marketing)/`, `app/(auth)/`, `app/(app)/{onboarding,settings,billing,alerts}/`, `app/layout.tsx`, `app/api/{health,me,profile,billing,stripe,cron,alerts}/`, `.claude/`, this file and `docs/{SPEC,DESIGN,TECHNICAL}.md`, CI, deploy config |
  | Recipes & Cook | `src/modules/{recipes,cook}/`, `app/(app)/{recipes,cook}/`, `app/api/{recipes,ingredients,cook}/` |
  | Plan & Shop | `src/modules/{planning,preferences}/`, `app/(app)/{plan,shop,preferences}/`, `app/api/{plans,preferences}/` |
  | Receipts & Fridge | `src/modules/{receipts,fridge}/`, `app/(app)/{receipts,fridge}/`, `app/api/{receipts,fridge,stats}/` |
  | Data & Proof | seed data files `supabase/seed/*.csv`, `eval/`, `e2e/`, `docs/PRD.md`, write-up |

- **Build in:** the folders your user owns. Keep route files thin (parse, call one module
  function, return).
- **If a change is needed in a file you do not own, stop and tell the user.** Do not edit it,
  even to fix a typo. Propose the change instead.
- **Do not edit** without the Platform owner: `spec/contract.ts` (every side imports it; a
  silent change breaks teammates), `supabase/migrations/` (ordering conflicts), `package.json`
  and the lock file (all dependencies were installed in the skeleton), `src/platform/`.
- **Do not edit** without the Proof owner: `spec/targets.json` (targets are declared before
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
- **Tests with the code:** each module function you implement gets unit tests next to it; each
  AI unit you touch gets its eval run on `dev/` before you call it done.

## Definition of done
Run in order; all must pass. Inspection is not verification. "Done" means a teammate other
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
