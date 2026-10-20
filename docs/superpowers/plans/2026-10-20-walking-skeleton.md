# Cooky Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable, deployable Next.js app where every v1 interface exists (routes answer `501`, modules export typed stubs, all tables exist with RLS), so four owners can build in parallel on Day 1.

**Architecture:** One Next.js App Router app. Route files are thin and go through `src/platform/handler.ts`; business logic lives in `src/modules/<feature>/`; every model call goes through `src/platform/ai.ts`; Supabase Postgres holds everything, with SELECT-only RLS for clients and a server-side writer.

**Tech Stack:** Next.js 16.4 (App Router, Turbopack), React 19, TypeScript 5.9, Tailwind 4, zod 4, `@supabase/ssr` 0.12 + `@supabase/supabase-js` 2, `@anthropic-ai/sdk` 0.137, `stripe` 23, Vitest 4 (Node 20 compatible), Playwright 1.64 (installed, browsers not downloaded), Supabase CLI for local Postgres.

**Spec:** `docs/SPEC.md` (§0 scope, §8 contract, §9 data model, §14.1 skeleton), `spec/targets.json`, `AGENTS.md`.

## Global Constraints

- Node `>=20.9`; `.nvmrc` = `22` (Vercel runtime). Vitest stays on 4.x until local Node is 22.
- Import aliases: `@/*` → `src/*`, `@spec/*` → `spec/*`.
- Numbers come from `spec/targets.json` via import; never copied into code.
- Every route file uses `route()` from `src/platform/handler.ts`; unbuilt routes throw `notImplemented()` → `501`.
- Only `src/platform/ai.ts` imports `@anthropic-ai/sdk`. Only `src/modules/billing/` imports `stripe`.
- Error body: `{ error, status, code, requestId, resetAt? }`; `x-request-id` on every response.
- Ids: prefixed strings (`SPEC §8.1`); money integer cents; units `g | ml | count`.
- RLS: SELECT-only for `authenticated`; no INSERT/UPDATE/DELETE policies for client roles.
- App refuses to start with a Stripe key that is not `sk_test_` (when a key is set).
- `AI_MODE=fake` returns fixture outputs and spends nothing; it is the default when `ANTHROPIC_API_KEY` is unset.

## Review Focus

1. A route called without a session returns `401` with the error body, not a redirect or HTML → handler test.
2. A thrown non-`ApiError` (bug, dependency failure) returns `500` with a request id and is logged, never swallowed → handler test.
3. A malformed JSON body returns `400 invalid_input`, not `500` → handler test.
4. An AI output that fails the schema twice ends `terminated: "error"` with `502 model_error`; one that exceeds the cost budget ends `terminated: "cap"` → ai test.
5. A unit string from a receipt such as `"LB"`, `"1.32 lb"`, `"fl oz"` or an unknown unit converts or returns `null`, never a guess → units test.

---

### Task 1: Scaffold, dependencies, static checks (S1)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.nvmrc`, `.gitignore`, `.env.example`, `app/globals.css`, `scripts/check-static.mjs`

- [ ] Scaffold with `create-next-app@16.4.2` into a temp dir (TypeScript, Tailwind, ESLint, App Router, no `src/app`), copy config files in; install runtime deps (`@supabase/ssr @supabase/supabase-js @anthropic-ai/sdk stripe zod`) and dev deps (`vitest@4 @vitest/coverage-v8@4 tsx @playwright/test`).
- [ ] Scripts: `dev`, `build`, `start`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `check` (`lint && typecheck && node scripts/check-static.mjs`), `check:contract`, `seed`, `smoke`, `eval`, `gate`.
- [ ] `check-static.mjs` fails (exit 2) when: a file outside `src/platform/ai.ts` imports `@anthropic-ai/sdk`; a file outside `src/modules/billing/` imports `stripe`; a tracked file matches `sk_live_`, `sk_test_[A-Za-z0-9]{16,}`, `sk-ant-[A-Za-z0-9-]{16,}` or `sb_secret_`; an env var named `NEXT_PUBLIC_*` contains `SECRET` or `KEY` other than `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Verify: `npm run check` exits 0 on the empty scaffold; adding `import Anthropic from "@anthropic-ai/sdk"` to a page makes it exit 2.

### Task 2: Contract as code (S2)

**Files:**
- Create: `spec/contract.ts`, `spec/routes.ts`, `scripts/check-contract.ts`, `spec/contract.test.ts`

**Interfaces — Produces:**
- `spec/contract.ts`: zod schemas + inferred types for every §8.2 body and response, records (§9 shapes the UI reads), AI outputs (`ReceiptExtraction`, `RecipeExtraction`, `PlannerChoice`, `CookAnswer`, `PreferenceProposals`), `ErrorBody`, `RunInfo`, `RunRecord`, enums (`Unit`, `Location`, `Category`, `LineKind`, `LineDecision`, `Confidence`).
- `spec/routes.ts`: `routes: RouteDef[]` where `RouteDef = { method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE"; path: string; file: string; auth: "public"|"user"|"pro"|"cron"|"stripe"; owner: Owner; v: 1|2; spec: string }`.

- [ ] Test `every route in the registry has a route file exporting its method`: for each `routes` entry, `app/api/<file>/route.ts` exists and its source contains `export const <METHOD>`.
- [ ] Test `contract schemas parse a valid example and reject an invalid one` for `PlanDraft`, `ReceiptDraft`, `FridgeView`, `CookAnswer`, `ErrorBody`.
- [ ] `check-contract.ts`: runs the registry/file check, validates `spec/targets.json` (every budget value > 0, shares in 0..1, every target has a note), validates seed CSV headers against `supabase/seed/README.md` column lists. Exit 0/2.

### Task 3: Platform primitives

**Files:**
- Create: `src/platform/{errors,ids,units,money,config,log}.ts` with tests next to each.

**Interfaces — Produces:**
- `class ApiError extends Error { status: number; code: string; resetAt?: string }`; helpers `badRequest(code, msg)`, `unauthorized()`, `forbidden(code)`, `notFound()`, `conflict(code, body?)`, `unprocessable(code, msg)`, `tooMany(resetAt)`, `notImplemented(what)`, `upstream(code, msg)`, `unavailable(code)`.
- `newId(prefix: IdPrefix): string` → `${prefix}_${26-char lowercase base32 time-sortable}`.
- `toBase(qty: number, unit: string): { qty: number; unit: "g"|"ml"|"count" } | null` (lb, oz, kg, g, l, ml, fl oz, ea, each, ct, count, pc; case-insensitive; trims; `null` for anything else).
- `formatUsd(cents: number | null): string` ("price unknown" for null); `sumCents(xs: (number|null)[]): { total: number; unknownCount: number }`.
- `config`: lazily parsed env (zod) with `aiMode`, `models.default`, `models.receipt`, `stripeMode`; `assertSafeStripeKey()` throws when a key is set and not `sk_test_`.
- `log(event: string, fields: Record<string, unknown>)` → one JSON line to stdout.
- [ ] Tests: `toBase(1.32,"lb")` → `{qty:598.74…→ rounded to 0.01 g, unit:"g"}`; `toBase(2,"EA")` → `{2,"count"}`; `toBase(1,"bunch")` → `null`; `sumCents([100,null,250])` → `{total:350, unknownCount:1}`; `formatUsd(1050)` → `"$10.50"`; `newId("itm")` matches `/^itm_[0-9a-z]{26}$/` and two ids sort by creation; `assertSafeStripeKey` throws on `sk_live_x`.

### Task 4: Database clients, auth, request handler

**Files:**
- Create: `src/platform/{db,auth,handler}.ts`, `src/platform/handler.test.ts`, `proxy.ts` (session refresh; Next 16 name for middleware — confirm against installed Next docs).

**Interfaces — Produces:**
- `reader(): Promise<SupabaseClient>` (publishable key + request cookies, RLS applies); `writer(userId: string): { db: SupabaseClient; userId: string }` (secret key, server only); `browserClient()` in `src/platform/db-browser.ts`.
- `getSessionUser(): Promise<{ id: string; email: string } | null>`.
- `route<B, Q>(opts: { auth: RouteDef["auth"]; body?: ZodType<B>; query?: ZodType<Q>; handler: (ctx: Ctx<B, Q>) => Promise<unknown | Response> }): (req: Request, info: { params: Promise<Record<string,string>> }) => Promise<Response>`; `Ctx = { req, requestId, user: {id,email} | null, params, body: B, query: Q }`. `auth:"pro"` checks `entitlements` via `reader()`; `auth:"cron"` checks `Authorization: Bearer ${CRON_SECRET}`; `auth:"stripe"` passes the raw request through.
- Test seams: `__setTestAuth(fn)` to stub `getSessionUser` and the Pro lookup.
- [ ] Tests: no session on `auth:"user"` → 401 body with `code:"unauthorized"` and `x-request-id` header; incoming `x-request-id` is echoed; handler throwing `notImplemented()` → 501 `not_implemented`; throwing `new Error("boom")` → 500 `internal` and a log line; invalid JSON → 400 `invalid_input`; zod failure → 400 with issue path; returned plain object → 200 JSON; Free user on `auth:"pro"` → 403 `not_pro`.

### Task 5: AI gateway and quotas

**Files:**
- Create: `src/platform/ai.ts`, `src/platform/ai-fixtures.ts`, `src/platform/quotas.ts`, `src/platform/ai.test.ts`

**Interfaces — Produces:**
- `type AiUnit = "receipt_reader" | "recipe_importer" | "planner" | "cook_assistant" | "preference_proposer"`.
- `runAi<T>(opts: { unit: AiUnit; userId: string; requestId: string; schema: ZodType<T>; system: string; content: Anthropic.ContentBlockParam[]; validate?: (out: T) => string[]; effort?: "low"|"medium"|"high" }): Promise<{ output: T; run: RunInfo }>` — fake mode returns `aiFixtures[unit]` (or a test override) through the same validate/repair/caps path; live mode uses structured outputs; repairs ≤ `budgets[unit].maxRepairs` by appending the violations; caps from `budgets[unit]`; cost from `costModel`; checks `limits.globalDailySpendCapUsd`; writes one `runs` row via `writer`. Errors: refusal → 422 `ai_refused`; SDK/API error → 502 `model_error`; exhausted repairs → 502 `model_error`; cap → 502 with `terminated:"cap"`; spend cap → 503 `ai_paused`.
- `consumeQuota(userId: string, feature: QuotaFeature, plan: "free"|"pro"): Promise<{ used: number; limit: number; resetAt: string | null }>` — calls `consume_quota` RPC; throws `tooMany(resetAt)` when over; throws `forbidden("not_pro")` when the Free limit is 0.
- [ ] Tests (fake mode, injected fixtures, run-record writer stubbed): valid fixture → `terminated:"done"`, `repairs:0`; fixture failing `validate` once then passing → `repairs:1`; failing schema every time → throws 502 and `terminated:"error"`; simulated cost above `maxCostUsd` → `terminated:"cap"`.

### Task 6: Migrations, RLS, functions, seed (S3)

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261020000000_init.sql`, `supabase/seed/README.md`, `supabase/seed/*.csv` (headers + a few sample rows), `scripts/seed.ts`

- [ ] Migration creates every §9 table (v1 and v2), the `updated_at`-free append-only `inventory_events`, indexes named in §9, `enable row level security` on all, `select` policies only (`user_id = auth.uid()` for user rows; catalog rows readable when `owner_id is null` or own), `revoke insert, update, delete` from `anon, authenticated` on all tables, private storage bucket `receipts`.
- [ ] Functions (security definer, `execute` granted to `service_role` only): `consume_quota(p_user uuid, p_feature text, p_period text, p_limit int) returns table(used int, lim int)` — atomic upsert that refuses when `count >= p_limit`; `apply_inventory_batch(p_user uuid, p_batch_key text, p_events jsonb) returns jsonb` — no-op returning prior result when the batch exists; else inserts events with `seq`, updates `fridge_items.qty`, raises `insufficient_stock` when any quantity would go below zero, all in one transaction.
- [ ] Seed CSVs: `ingredients.csv`, `products.csv`, `category_defaults.csv`, `recipes.csv`, `recipe_ingredients.csv`, `recipe_chunks.csv`; `scripts/seed.ts` validates rows with contract schemas and upserts with the secret key.
- [ ] Verify on local Supabase: `supabase start`, `supabase db reset` applies cleanly; `npm run seed` loads sample rows; as an `authenticated` user, `select` on own `fridge_items` works and `insert` is denied; `select consume_quota(...)` twice past limit refuses; `apply_inventory_batch` twice with one key writes once.

### Task 7: Route and module stubs (S5)

**Files:**
- Create: `app/api/**/route.ts` for every `spec/routes.ts` entry; `src/modules/{recipes,planning,preferences,receipts,fridge,cook,alerts,billing}/index.ts`

**Interfaces — Produces (joins, SPEC §14.3), each throwing `notImplemented("<module>.<fn>")`:**
- `fridge.proposeDeductions(userId, recipeId, servings): Promise<Deduction[]>`, `fridge.applyBatch(userId, events, batchKey): Promise<FridgeView>`, `fridge.expiringSoon(userId): Promise<FridgeItem[]>`, `fridge.cookNow(userId): Promise<CookNowEntry[]>`, `fridge.view(userId)`.
- `recipes.retrieveChunks(recipeId, question): Promise<Chunk[]>`, `recipes.list(...)`, `recipes.get(...)`.
- `planning.priceRecipes(userId, recipeIds, servings): Promise<ShoppingList>`, `planning.createPlan(...)`.
- `preferences.propose(userId, text, context): Promise<PreferenceProposal[]>`.
- `receipts.parse(...)`, `receipts.confirm(...)`; `cook.ask(...)`; `billing.createCheckout(...)`, `billing.handleWebhook(...)`, `billing.entitlement(...)`; `alerts.list(...)`.
- [ ] `GET /api/health` implemented: `{ status, version, model, db, stripeMode, storage }`, `db` = `"ok"` or the error message from a `select 1`-style ping.
- [ ] Verify: `npm run check:contract` passes; `curl -i localhost:3000/api/fridge` (no session) → 401; with a session → 501 `not_implemented`; `/api/health` → 200.

### Task 8: App shell and pages (S6)

**Files:**
- Create: `app/layout.tsx`, `app/(marketing)/page.tsx`, `app/(auth)/{login,signup}/page.tsx`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`, `app/(app)/layout.tsx` (session required → redirect `/login`), one `page.tsx` per v1/v2 page in TECHNICAL's layout, `src/ui/{Nav,NotImplemented,Card,Button}.tsx`

- [ ] Login/sign-up with email + password via the browser client; errors shown inline; sign-out route.
- [ ] Each feature page renders `<NotImplemented title owner specIds v />` with the owner and requirement IDs.
- [ ] Verify against local Supabase: sign up → land on `/fridge` → click every nav item → each shows its panel; sign out → `/login`.

### Task 9: Team harness, scripts, CI, docs (S8, S9)

**Files:**
- Create: `.claude/skills/cooky-module/SKILL.md`, `.claude/agents/contract-reviewer.md`, `scripts/{smoke,gate,eval}.ts`, `eval/README.md`, `eval/smoke/<set>/README.md`, `.github/workflows/ci.yml`
- Modify: `README.md` (status, start here), `docs/TECHNICAL.md` (real commands, local Supabase steps)

- [ ] `smoke.ts --base-url`: `/api/health` 200; every `v:1` route without a session → 401 (or 400/401 for stripe/cron); exit 0/2.
- [ ] `gate.ts [--upto N] --base-url`: runs check (0), check:contract (1), test, smoke (2) in order, stops on first failure, exit 0/1/2; checks 3–4 print "not yet implemented" as a warning (exit 1).
- [ ] `eval.ts <set>`: prints "no eval for <set> yet" and exits 1 (owners fill it in).
- [ ] CI on push/PR: `npm ci`, `npm run check`, `npm run check:contract`, `npm test`.
- [ ] Verify: `npm run gate -- --upto 2 --base-url http://localhost:3000` exits 0 with the dev server and local Supabase running.

### Task 10: Final verification and commit

- [ ] `npm run build` succeeds.
- [ ] Full local run as in Task 7–9 verifications; screenshots of login and one feature page.
- [ ] Commit on `main` (first commit). Deploy (S7) is Frank's: create the Supabase project and Vercel project, set env vars per `docs/TECHNICAL.md`, register the Stripe webhook.
