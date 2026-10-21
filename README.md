# Cooky

> A meal-planning web app with a virtual fridge: plan meals from what you already have, buy
> exactly what the recipes need, snap the receipt to stock the fridge, and cook the right dish
> before food goes off. MGMT 298E capstone; Next.js, Supabase, Claude and Stripe test mode.

## Start here

**Status: walking skeleton.** Every route answers `501 not implemented` and every page shows a
"Not implemented" panel; sign-up, log-in, the database and the checks work. Only the v1 scope in
[SPEC §0](docs/SPEC.md#0-demo-day-scope-v1) gets built before demo day.

Needs Node 22 (`.nvmrc`) and Docker (for the local database).

```bash
nvm use && npm install
npx supabase start                    # local Postgres, Auth, Storage on ports 563xx
cp .env.example .env.local            # then paste API_URL, PUBLISHABLE_KEY, SECRET_KEY from:
npx supabase status -o env
npm run seed                          # loads supabase/seed/*.csv
npm run dev                           # http://localhost:3000 → sign up → click around
npm run dev:grant-pro -- you@example.com   # local only: unlock Pro features before billing exists
```

**Shared live database.** The team's hosted Supabase is already set up and seeded. Build
against your local database day to day; to run against the live one, copy
`.env.hosted.example` to `.env.hosted`, add the secret key Frank sends you privately, then run
`npm run dev:hosted`. Details: [TECHNICAL](docs/TECHNICAL.md#shared-hosted-database).

Every panel that says "Not implemented" is the progress bar. AI runs in fake mode until
`ANTHROPIC_API_KEY` is set, so you can build pages without spending the team budget.
Building a feature with Claude Code? It loads `AGENTS.md`; ask it to use the `cooky-module` skill.

## Read, in this order

| # | Read | Why | Minutes |
|---|---|---|---|
| 0 | [`docs/PROPOSAL.md`](docs/PROPOSAL.md) | **Start here:** the plan, who does what, and your first hour | 10 |
| 0b | [`docs/ROLES.md`](docs/ROLES.md) | How data moves between roles, handoffs, what each role can grow into | 10 |
| 1 | [`docs/PRD.md`](docs/PRD.md) | What we are building, the journey without and with Cooky, the core tension | 10 |
| 2 | [`docs/DESIGN.md`](docs/DESIGN.md) | The five design questions and our trade-offs | 8 |
| 3 | [`docs/TECHNICAL.md`](docs/TECHNICAL.md) | Architecture by owner, env vars, commands, troubleshooting | 12 |
| 4 | `spec/targets.json` | What "working" means, in numbers | 5 |
| 5 | [`docs/SPEC.md`](docs/SPEC.md) | Every requirement, route, table and check (reference, not cover to cover) | as needed |

Coding agents load [`AGENTS.md`](AGENTS.md) (via `CLAUDE.md`) and work from `docs/SPEC.md`.

## What is yours

Split by ownership of files; each owner builds *and* verifies their folders. Names are
placeholders until the team assigns them.

| Owner | Folders | Others may edit? |
|---|---|---|
| Platform (Frank) | `src/platform/`, `src/ui/`, `spec/contract.ts`, `supabase/migrations/`, `src/modules/{billing,alerts}/`, landing, auth, onboarding, settings, billing and alerts pages, `.claude/`, CI, deploy | No: propose changes |
| Recipes & Cook | `src/modules/{recipes,cook}/`, recipe library and cook pages, catalog CSVs in `supabase/seed/` | No |
| Plan & Shop (Richard) | `src/modules/{planning,preferences}/`, plan, shop and preferences pages | No |
| Receipts (Hanson) | `src/modules/receipts/`, camera and receipt review pages | No |
| Fridge (Una) | `src/modules/fridge/`, fridge page, stats | No |
| Data & Proof (non-coders) | `eval/` cases, `docs/PRD.md`, write-up, slides; seed rows by PR | No |
| Everyone, with review | `spec/targets.json` (Data & Proof owner approves), `package.json` (Platform owner approves) | Only through the owner |

## Where we are

What works on `main` today, step by step through the journey, and what is next: SPEC §14.5.
Review requests follow `.github/CODEOWNERS`.

## Build order (two days)

1. **Day 0 → Day 1 morning:** Frank lands the walking skeleton (every route `501`, deployed);
   Data & Proof fill the seed CSVs and photograph receipts (SPEC §14.1).
2. **Day 1:** accounts and Stripe; fridge ledger and page; shopping math; then the planner and
   receipt scan, in parallel by owner (SPEC §14.2).
3. **Day 1 gate:** a new account on the public URL signs up, pays in test mode, gets a plan,
   saves it, and stocks the fridge from a receipt. Shown live, not described.
4. **Day 2 morning:** cook deductions, *Cook now*, cooking assistant; swap and preferences only
   if the gate passed.
5. **Day 2 afternoon:** feature freeze, smoke evals, billing and authorization scenarios,
   classmate test, write-up, slides, two rehearsals.

If behind, cut in the order in SPEC §14.4. Never cut login, Stripe, the planner, shopping math,
receipt → fridge, or the live URL.

## How to prove it

```bash
npm run check                                  # static: lint, types, secrets, live-key guard
npm run check:contract                         # schemas, seed and reference sets validate
npm run test                                   # unit tests
npm run gate -- --upto 2 --base-url "$PREVIEW_URL"   # before merging: checks 0-2
npm run gate -- --base-url "$PREVIEW_URL"            # milestones: checks 0-4, every target
```

Exit codes: `0` pass, `1` warnings, `2` fail. What each check measures, and against which
target: SPEC §13.

## Stuck?

- Troubleshooting table (webhooks, RLS, email limits, timeouts, model errors): [`docs/TECHNICAL.md`](docs/TECHNICAL.md#troubleshooting).
- Need a change in a folder you do not own: ask its owner; do not edit it.
- A target looks wrong: raise it with the Data & Proof owner; never loosen it to pass.
