# Cooky — design

> The five design questions, answered for the choices actually made. Details and diagrams:
> [`SPEC.md`](SPEC.md) §6; the picture is [`architecture.png`](architecture.png).

## Components

- **Web app** (Next.js on Vercel): pages for onboarding, fridge, plan, shop, receipts, recipes,
  cook mode, settings and billing, plus one API route per operation.
- **Platform layer** (`src/platform/`): the request wrapper (identity, request id, validation,
  errors), the database clients, the AI gateway (`ai.ts`), quotas, unit and money helpers.
- **Feature modules** (`src/modules/`): recipes, planning, preferences, receipts, fridge
  (including the inventory ledger), cook, alerts, billing.
- **AI units**, all called through `ai.ts`, each one structured call on a small, cheap model:
  `receipt_reader`, `planner` (chooses among options code has already found and priced),
  `cook_assistant` (retrieval-grounded), `preference_proposer`, and `recipe_importer`
  (describe a dish; import from a link or photo is v2).
- **Supabase**: Postgres with row-level security (all records, the inventory ledger, run
  records, quota counters), Auth, private Storage for receipt and recipe images.
- **Stripe** (test mode) for checkout and the payment webhook.
- **Vercel Cron** for the daily expiry run; **Resend** for the digest email.
- **State-holding pieces that are not services:** the `inventory_events` ledger, the `runs`
  table, `usage_counters`, `guard_events`.

## Responsibilities

- Only **pages** talk to the user, and they talk only to our own `/api` routes.
- Only the **request wrapper** decides who the caller is; no route reads a user id from input.
- Only **`ai.ts`** holds the Claude key, calls the model, decides that a quota or budget is
  exhausted, and writes run records.
- Only **`fridge/ledger.ts`** changes fridge quantities, and only for events the user
  confirmed. Receipts and cook mode *propose*; the ledger *applies*.
- Only **`planning/shopping.ts`** computes quantities, packages and costs. The model chooses
  and explains; it never does arithmetic.
- Only **billing** writes entitlements, and only from a verified webhook. A browser redirect
  cannot unlock Pro.
- Only **code** decides whether a receipt line is auto-accepted or flagged; the model reports a
  confidence, the rule decides.
- Only **Postgres** stores data; there is no second store to keep in sync.

## Communication

- Browser ↔ API: HTTPS JSON request/response with the Supabase session cookie. If the API is
  down, pages show an error state with retry; nothing is cached as if it succeeded.
- API ↔ Claude: synchronous calls inside the request, with per-unit time and cost caps. If
  Claude is down or refuses, the request fails with an honest error and the run is recorded;
  a receipt is kept as `failed` so the user can retry without re-uploading.
- API ↔ Postgres: SQL through the Supabase client; multi-row changes (receipt confirm, cook
  confirm, webhook) in one transaction. If the database is down, the request fails; nothing is
  half-written.
- Stripe → API: webhook with a signature. If our database write fails we return an error so
  Stripe retries; event ids make retries safe. The user's page polls our entitlement endpoint
  rather than trusting the redirect.
- Cron → API: once a day with a shared secret. A missed run is caught up by the next one,
  because alerts are computed from current expiry dates, not from a queue.

## State

- **Only copies:** user profiles, the recipe catalog and imports, plan versions, fridge items
  and the inventory ledger, preferences, orders and entitlements. All in Postgres, all owned
  per user and protected by row-level security (catalog rows are shared and read-only).
- **Derived and rebuildable:** recipe chunks (rebuilt from recipes), *Cook now* rankings and
  alerts (recomputed from the fridge), quota counters (rebuildable from run records).
- **Short-lived:** receipt images are deleted once the receipt is confirmed; the parsed lines
  remain.
- **Consistency:** Postgres is strongly consistent for our reads, so "saved" means visible.
  Drafts (plans, receipt parses, cook proposals) are stored with a status so a refresh does not
  lose them, but they change nothing until confirmed.

## Trade-offs

- **One shared Postgres instead of a vector database.** Full-text ranking over a recipe's own
  steps and FAQs is enough for a small corpus and keeps one source of truth. We give up
  semantic matching of paraphrased questions; retrieval recall is measured so we know if this
  breaks.
- **The planner is one model call over options code already found, not a tool-using agent.**
  Code enumerates and prices every feasible set of meals; the model only picks one and
  explains it. This is fast, cheap and hard to get wrong. We give up letting the
  model explore trade-offs on its own. **We are unsure the model adds much over a simple
  rule** ("cheapest set that uses the most expiring food"); SPEC §13.6 compares them and we
  will report the answer either way. A tool-using agent is the first thing to try next.
- **A small, cheap model everywhere.** The model budget is small, and the hard parts
  (math, filtering, permissions) are code anyway. We risk weaker receipt reading; if the smoke
  set shows it, only the receipt unit moves to a larger model.
- **Generic items for food the catalog doesn't know.** Snacks, drinks and bread are stocked by
  category with a typical shelf life, so the fridge stays complete and the catalog stays small.
  Plans ignore them, so the fridge and the plan see slightly different worlds.
- **Synchronous receipt parsing instead of a background job.** Simpler to build and to reason
  about. We risk serverless timeouts on slow vision calls;
  the latency target and the budget cap watch for it, and the async-job pattern is the
  documented fallback.
- **One-time test price instead of a subscription.** Simplest Stripe flow to get right. It does
  not cover the ongoing model cost of an active user (at most about US$0.19 a week at the cost
  caps), so the next step is a subscription or cheaper models per feature.
- **User confirms every fridge change.** Costs a tap per receipt and per meal, and caps how
  "magic" it feels. In exchange the fridge stays trustworthy, which every other feature
  depends on.
