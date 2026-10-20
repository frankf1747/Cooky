# Cooky — technical guide

Open this while building. Intent is in [`PRD.md`](PRD.md); every requirement is in
[`SPEC.md`](SPEC.md); numbers are in `spec/targets.json`. Commands below are the planned
interface of the skeleton (SPEC §14.1); until the skeleton lands, they do not exist yet.

## Architecture, by owner

```
                    ┌──────────────────────── Vercel (Next.js) ────────────────────────┐
 Browser ──HTTPS──► │ app/(auth) app/(app)/settings,billing        [Platform]          │
                    │ app/(app)/recipes, cook                      [Recipes & Cook]    │
                    │ app/(app)/plan, shop                         [Plan & Shop]       │
                    │ app/(app)/receipts, fridge                   [Receipts & Fridge] │
                    │                                                                  │
                    │ app/api/**  ──► src/platform/handler.ts      [Platform]          │
                    │                   │                                              │
                    │                   ├─► src/modules/<feature>  [feature owner]     │
                    │                   │      └─► src/platform/ai.ts ──► Claude API   │
                    │                   └─► src/platform/db.ts ──► Supabase (Postgres, │
                    │                                              Auth, Storage)      │
                    │ app/api/stripe/webhook ◄── Stripe (test)     [Platform]          │
                    │ app/api/cron/alerts ◄── Vercel Cron ──► Resend [Platform]        │
                    └──────────────────────────────────────────────────────────────────┘
 eval/, e2e/ run against the deployed preview URL                    [Data & Proof]
```

## What exists and what we build

| Exists (we configure it) | Constraint to remember |
|---|---|
| Supabase Auth, Postgres, Storage | Default auth email sending is heavily rate-limited; set custom SMTP before the pilot. RLS returns empty results, not errors, when a policy denies. |
| Stripe Checkout (test mode) | Webhooks need the raw body and a public URL; local dev uses the Stripe CLI. |
| Claude API (`@anthropic-ai/sdk`) | Default model `claude-haiku-5-5` (cheap; step a unit up to `claude-sonnet-5-5` only if it misses its smoke targets). Use structured outputs for JSON, set `effort` explicitly, check `stop_reason` for `refusal` (Haiku has no server-side refusal fallback). Team budget is small: `limits.globalDailySpendCapUsd`, and `AI_MODE=fake` for tests and local UI work. |
| Vercel hosting + Cron | Function duration limits depend on the plan; cron frequency limits on the free plan. Check both before relying on them. |
| Resend | Free tier daily send limit; verify a sending domain or use the test sender for the demo. |

| We build | Path |
|---|---|
| Contract (zod schemas + types) | `spec/contract.ts` |
| Platform: handler, auth, db, ai, quotas, units, money, ids, errors, email | `src/platform/` |
| Feature modules | `src/modules/{recipes,planning,preferences,receipts,fridge,cook,alerts,billing}/` |
| Pages | `app/(marketing)`, `app/(auth)`, `app/(app)/*` |
| Routes | `app/api/**/route.ts` (one file per route in SPEC §8.2) |
| Schema, RLS, functions | `supabase/migrations/` |
| Seed data: ingredients, products, shelf life, recipes, chunks | `supabase/seed/` |
| Reference sets, eval scripts, rules | `eval/` |
| End-to-end journey | `e2e/` |
| Team agent harness | `.claude/skills/cooky-module/`, `.claude/agents/` |

## Planned layout

```
app/
  (marketing)/page.tsx
  (auth)/login, signup, callback
  (app)/onboarding, fridge, plan, plan/[id], shop/[planId], receipts/new, receipts/[id],
        recipes, recipes/[id], recipes/import, cook/[recipeId], preferences, alerts,
        settings, billing
  api/<one folder per route in SPEC §8.2>/route.ts
src/
  platform/  handler.ts auth.ts db.ts ai.ts quotas.ts units.ts money.ts ids.ts errors.ts email.ts config.ts
  modules/<feature>/  index.ts (exported functions) · *.ts · prompts/ · *.test.ts
  ui/        shared components (Platform owns; others add their own under their pages)
spec/        contract.ts targets.json
supabase/    migrations/ seed/
eval/        rules.md reference/<set>/{dev,test}/ scripts/ runs/ (gitignored)
e2e/         journey.spec.ts
```

## Contract rules that matter

See SPEC §8.3. The three that break teammates most often: AI endpoints never write records;
every id in AI output is validated against the run's candidates; money is integer cents with
`null` for unknown.

## Build order, with commands

Skeleton first (SPEC §14.1), then the critical path (SPEC §14.2).

1. **Scaffold and install everything once.** `npm install`, then `npm run dev` serves the
   landing page and `npm run check` passes.
2. **Supabase.** Create the project; `npx supabase link`; `npx supabase db push` applies
   migrations; `npm run seed` loads `supabase/seed/`.
3. **Env.** Copy `.env.example` to `.env.local` and fill it (table below). `npm run check`
   refuses a live Stripe key.
4. **Stubs.** `npm run dev`, then `curl localhost:3000/api/health` returns `200` and any other
   route returns `501` with `x-request-id`.
5. **Deploy.** Import the repo in Vercel, set env vars for Preview and Production, deploy.
   Add the Stripe webhook endpoint `https://<url>/api/stripe/webhook` for the events in SPEC
   ACC6; add the cron in `vercel.json` with `limits.alertCronUtc`.
6. **Checks against the fake.** `AI_MODE=fake npm run gate -- --base-url http://localhost:3000`
   passes; break the fake on purpose (wrong id, over budget) and confirm the gate fails.
7. **Feature work** in each owner's folders, merging small and often to an always-runnable `main`.

## Environment variables

| Name | Where read | Secret | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | no | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client + server | no | publishable (anon) key; RLS protects data |
| `SUPABASE_SECRET_KEY` | `db.ts` writer client only | yes | bypasses RLS. Clients can only read (SPEC §9), so every write goes through `db.writer(userId)` after the handler resolved the session; webhook, cron and seed use it with their own authorization checks |
| `ANTHROPIC_API_KEY` | `ai.ts` only | yes | |
| `CLAUDE_MODEL` | `config.ts` | no | default `claude-haiku-5-5` |
| `RECEIPT_MODEL` | `config.ts` | no | optional per-unit override, e.g. `claude-sonnet-5-5` |
| `AI_MODE` | `ai.ts` | no | `live` or `fake` (tests and the skeleton) |
| `STRIPE_SECRET_KEY` | `billing/` only | yes | must start with `sk_test_` |
| `STRIPE_WEBHOOK_SECRET` | `billing/webhook.ts` | yes | |
| `STRIPE_PRICE_ID_PRO` | `billing/` | no | the only allowlisted price |
| `RESEND_API_KEY` | `email.ts` | yes | |
| `CRON_SECRET` | `/api/cron/alerts` | yes | Vercel sends it as a bearer token |
| `APP_URL` | server | no | for Stripe return URLs and email links |

## Deploy table

| Piece | Host | Public | Secrets |
|---|---|---|---|
| Web app + API | Vercel | yes | server env only |
| Database, auth, files | Supabase | API only, RLS on | — |
| Checkout | Stripe | yes | — |
| Email | Resend | — | — |

## Targets and how each is measured

The mapping from every key in `spec/targets.json` to its instrument is SPEC §13.1. Run them:

```bash
npm run eval -- receipts --split dev      # one set while tuning
npm run bench -- --base-url "$URL"        # latency, cost, error rate on the deployed URL
npm run gate -- --upto 2 --base-url "$URL"  # before a merge: checks 0-2
npm run gate -- --base-url "$URL"         # milestones and nightly: checks 0-4; exit 0 / 1 / 2
```

Live evals spend real API money; run `dev/` splits while tuning and the full set at milestones.

Results go to `eval/runs/<date>-<set>.json` (gitignored); the write-up quotes the final `test` run.

## Self-verify, before saying "done"

1. `npm run check && npm run check:contract && npm run test`
2. `npm run eval -- <your set> --split dev` meets its targets.
3. Push; on the preview URL, `npm run smoke -- --base-url "$PREVIEW_URL"`.
4. Click through your feature on the preview as a fresh user: loading, empty, error and retry
   states all appear when forced (use `AI_MODE=fake` with a failing fixture).
5. Ask another owner to run steps 1–3 and confirm.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Webhook returns `400` for real Stripe events | Body parsed as JSON before signature check | In the route, read `await req.text()` and verify that string; never `req.json()` first |
| Pro never unlocks after test checkout | Webhook endpoint not registered for the preview URL, or wrong signing secret per environment | Check the endpoint in the Stripe dashboard; each endpoint has its own secret |
| Sign-up emails stop arriving | Supabase default SMTP rate limit | Configure Resend SMTP in Supabase Auth settings |
| Query returns `[]` instead of an error | RLS policy denies | Check the session is passed to the server client; check the policy for that table |
| Receipt parse times out on Vercel | Large image or slow call exceeds the function limit | Downsize client-side to `limits.receiptImageMaxPx`; confirm the route's max duration; see DESIGN trade-off on async jobs |
| Model returns `400` about `tool_choice` or `thinking` | A setting the chosen model rejects (forced tool choice, disabled thinking on some models) | Use structured outputs for JSON; omit `thinking` and lower `effort`; check the model notes in the claude-api docs |
| AI routes return `503 ai_paused` | Team-wide daily spend cap reached | Expected; switch to `AI_MODE=fake` for UI work, or raise `limits.globalDailySpendCapUsd` with a note |
| iPhone photo rejected | HEIC upload | Convert to JPEG in the browser before upload (canvas re-encode) |
| Two teammates' migrations conflict | New migration created outside the skeleton | Ask the Platform owner; migrations are owned in one place |
