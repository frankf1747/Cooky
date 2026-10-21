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
                    │ app/(app)/receipts                           [Receipts]          │
                    │ app/(app)/fridge                             [Fridge]            │
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

### Today's date

Use `localToday(userId)` from `src/platform/dates.ts` for "today" (added dates, expiry dates,
expiring soon). It uses the profile timezone, or the `profiles.timezone` default for a user who
has not onboarded yet; never the server's UTC date.

### Fridge writes

Two database functions change the fridge. Both run as one locked transaction, are idempotent
by key, and can be called only from server code through `writer(userId).db.rpc(...)`.

| Function | Use it for | Errors (message prefix, SQLSTATE) |
|---|---|---|
| `apply_inventory_batch(p_user, p_batch_key, p_events, p_today?)` | adding items and relative changes (receipt confirm `rct:<receiptId>`, cook confirm `cke_…`, manual add `man:<key>`) | `insufficient_stock:<itemId>` P0001, DETAIL `{"available","requested","shortBy"}` → 409 · `item_not_found:<itemId>` P0002 → 404 |
| `edit_fridge_item(p_user, p_item, p_key, p_expected_qty, p_qty?, p_status?, p_location?, p_expires_on?, p_expiry_source?)` | one item: set a quantity, mark used or tossed, move, change the date (key `edt:<idempotencyKey>`; `p_expected_qty` is required) | `stale_quantity:<itemId>` P0001, DETAIL `{"expected","actual"}` → 409 · `item_not_active:<itemId>` P0001 → 409 · `item_not_found:<itemId>` P0002 → 404 · `invalid_quantity` / `invalid_edit:<why>` 22023 → 400 (`key_reused` when the key belongs to another change) |

- A repeat with the same key returns the first result with `"replayed": true` and writes
  nothing. Answer `200` (not `201`) for a replay.
- `added_on` is the user's local date: pass `p_today`, or leave it out and the function uses the
  profile's timezone (the `profiles.timezone` default when the user has no profile row yet).
- `edit_fridge_item` dates: `p_expiry_source: "user"` always applies; `"table"` or `"category"`
  (a date your code recomputed, e.g. after a move to the freezer) applies only when the stored
  date was not set by the user. Pass a date and its source together.
- Read the DETAIL with `error.details` from supabase-js and `JSON.parse` it. Tests:
  `supabase/tests/fridge_edits.test.sql`.

## Local development

Node 22 (`nvm use` reads `.nvmrc`; supabase-js needs Node 22's native WebSocket) and Docker.

```bash
nvm use && npm install
npx supabase start            # ports 563xx (see supabase/config.toml), so it can run beside other local Supabase projects
npx supabase status -o env    # API_URL, PUBLISHABLE_KEY, SECRET_KEY → .env.local
npm run seed                  # idempotent; validates every CSV row before loading
npm run dev
npx supabase test db          # database tests: access rules, quota, fridge ledger
npm run dev:grant-pro -- you@example.com   # local only: make a local account Pro (refuses hosted URLs)
npx supabase db reset         # wipe local data and re-apply migrations (then npm run seed)
```

Local email confirmation is off (`supabase/config.toml`), so sign-up logs you straight in.
Local auth emails, if turned on, land in Mailpit at http://127.0.0.1:56324.

## Shared hosted database

The team's live Supabase project is `jrkhuohfhqyzwkwrcvii` (US West). It has the full schema and
the seed data, and the same access rules as local (checked: with only the public key, user tables
read empty and every write is refused).

| What | Where it lives | Who has it |
|---|---|---|
| Project URL and publishable key | `.env.hosted.example` (committed; public by design, RLS protects data) | everyone |
| Secret key | `.env.hosted` (gitignored), Vercel env vars | Frank shares it privately, never in chat or git |
| Database password | Supabase dashboard | Frank only (needed for schema changes) |

```bash
cp .env.hosted.example .env.hosted    # then paste SUPABASE_SECRET_KEY from Frank
npm run dev:hosted                    # the app on http://localhost:3000 against the live database
npm run seed:hosted                   # reload seed data (Recipes & Cook, after CSV changes)
npx supabase db push                  # schema changes: Platform only; asks for the database password
```

Rules for the live database: it is shared, so use your own test account (`you+cooky@...`), never
delete other people's rows, and keep day-to-day development on the local database. Schema
changes are Platform-only: a new file in `supabase/migrations/`, tested locally with
`npx supabase db reset && npx supabase test db`, then `npx supabase db push`.

Hosted auth settings live in the Supabase dashboard (Authentication → URL Configuration): add
`http://localhost:3000` and the Vercel URL as redirect URLs. Email confirmation is on by
default and Supabase's built-in email sender is rate-limited; turn confirmation off for the
demo or connect Resend SMTP.

## Build order, with commands

The skeleton (SPEC §14.1) is in place; the critical path is SPEC §14.2.

1. **Deploy (Platform, once).** Supabase is done (see above). Import the GitHub repo in Vercel, set the env vars below for Preview and
   Production, deploy. In Stripe (test mode), create the Pro price, then a webhook endpoint
   `https://<url>/api/stripe/webhook` for `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`; put its signing secret in Vercel.
2. **Feature work** in each owner's folders: replace `notImplemented(...)` in
   `src/modules/<m>/index.ts`, test first, then the page. Merge small and often to an
   always-runnable `main`.
3. **Before each merge:** `npm run gate -- --upto 2 --base-url <preview URL>`.
4. **Add signed-in smoke cases** to `scripts/smoke.ts` as features land; add each eval runner to
   `scripts/eval.ts`.

## Environment variables

| Name | Where read | Secret | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | no | local: `http://127.0.0.1:56321` |
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
| `Node.js detected but native WebSocket not found` | Running a script on Node 20 | `nvm use` (Node 22) |
| `supabase start`: port is already allocated | Another local Supabase project uses the same ports | Cooky uses 563xx; stop the other project or change ports in `supabase/config.toml` |
| A write returns `permission denied` | Writing with `reader()`; clients may only read (SPEC §9) | Use `writer(userId).db` from server code |
| Planner/cook works locally but returns odd answers | `AI_MODE=fake` returns fixtures | Set `ANTHROPIC_API_KEY` and remove `AI_MODE=fake` to use the real model |
