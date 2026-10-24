# Cooky — product requirements

> Read this one. The exhaustive version is [`SPEC.md`](SPEC.md). No thresholds appear here;
> they live in `spec/targets.json`. A number restated in prose is a number that will be wrong
> next month.

## What we are building

Cooky is a web app for people who cook for one or two and shop about once a week. It knows
what is in your kitchen and what each item was bought for. You plan a few meals, take a
shopping list sized to real packages to the store, photograph the receipt when you get home,
and Cooky stocks a virtual fridge with what you bought and when it will likely go off. When
you open the fridge, it shows the dishes you can cook right now, the ones that rescue
soon-to-expire food first. Cook mode walks you through the steps and answers questions from
the recipe itself. When something is about to spoil, Cooky tells you what to make with it.

**The thesis.** Meal planners stop at the shopping list. Fridge trackers start at the fridge
and die of data entry. Cooky covers the whole loop and uses AI exactly where the data entry
is: reading receipts and recipes. Everything else is plain, checkable code.

## The journey: without Cooky and with it

| Stage | Without Cooky | With Cooky | Where AI earns its place |
|---|---|---|---|
| Choose | Recipes scattered across saved videos, screenshots and bookmarks, in different units | One library; paste a link and get a structured recipe to confirm | Reading messy recipe pages into clean ingredients |
| Plan | Guessed amounts, duplicate purchases, a surprise total | Plans start from the fridge; one list merged across meals, rounded to real packages, priced against the budget | Turning "one pan, nothing dry" into a choice, and explaining it |
| Shop | Items forgotten; a sold-out item breaks the recipe | A checklist on the phone | — |
| Stock | Groceries vanish into the fridge; typing them in is a chore people quit | Snap the receipt; review one screen; done. Missing planned items are pointed out | Reading abbreviated receipt lines into real ingredients |
| Cook | The plan is forgotten; half-used items are lost | *Cook now* ranks what you can make, soonest-to-expire first; cook mode answers questions with cited steps | Answering only from the recipe, and saying so when it cannot |
| Rescue | Spoiled food found days later | A heads-up before it spoils, with a dish to make or "freeze it" | — (plain code: cheap and reliable) |
| Learn | The same mistakes every week | Ratings and comments become preferences you confirm; the next plan uses them | Turning "a bit dry" into a preference you can approve |

## The core tension

Trust the AI's reading of receipts and recipes too much, and the virtual fridge fills with
wrong items, amounts and dates that quietly poison every plan and alert. Ask the user to check
everything, and logging becomes the chore that killed every fridge app before. Cooky
auto-accepts what it is sure of, flags only what it is not, and never changes the fridge
without the user's final tap. We measure both sides on the same receipts, so neither can be
bought by trading away the other.

## Capabilities

| Capability | What it means | Why it earns its place |
|---|---|---|
| Accounts and Pro | Sign up, log in, unlock Pro through a Stripe test checkout | Required for launch; Pro covers the features that cost model calls |
| Recipe library and import | Curated recipes now; your own, imported from links, next | Plans are only as good as the recipes; import makes the library yours |
| Fridge-aware planning | Meals chosen around what you have, your budget and preferences; exact list in packages | Solves "what to buy and how much" |
| Receipt to fridge | Photograph, review, confirm | Keeps the fridge true with almost no typing; the heart of the tension |
| Virtual fridge and cook mode | Items with typical use-by dates; *Cook now*; guided cooking; deductions you confirm | Solves "I forgot what to cook"; closes the loop |
| Cooking assistant | Answers grounded in the recipe's steps and notes, with citations | Retrieval-grounded answers, used where they help a real cook |
| Rescue alerts | A daily heads-up with an action | Turns the fridge record into money saved |
| Preferences | Comments become preferences you confirm, edit or delete | Plans get better without the user filling in forms |

## Principles that decide whether it works

- **Grounded or nothing.** Every item, recipe, citation and preference in an AI answer must be
  something Cooky handed the model in that request. Anything else is rejected.
- **The model chooses and explains; code counts.** Quantities, packages, prices and dates are
  computed by code. Money is never approximately right.
- **The user confirms every change to their records.** AI produces drafts; the fridge,
  preferences and payments change only on the user's tap or a verified payment.
- **Fail loud.** If the model is down, the user sees "we couldn't read this receipt, retry or
  add by hand", never an invented list.
- **Bounded and honest.** Caps on time, cost and retries; hitting one is reported as such.
- **Evidence over vibes.** Every claim about quality comes from a run, with its target declared first.
- **Controls live in code, not prompts.** Payments, permissions, quotas and personal data.

**Red lines:** no live payment keys; no secret in the browser or the repository; no user ever
sees another user's data; the model never writes the fridge; Cooky never says food is safe to
eat or a dish is allergen-free; no invented items, prices or citations.

## What exists and what we build

**Exists:** Supabase (sign-in, database, private files), Stripe test mode, the Claude API,
Vercel hosting and scheduled jobs, Resend for email, a published food-storage table for typical
shelf life (source to confirm).

**We build:** the contract, the platform layer, the feature modules and pages, the seed
catalog and recipes, the evaluation sets, and the coding-agent setup (`AGENTS.md`).

## Architecture in one picture

```
Browser ─► Next.js on Vercel ─► request wrapper (who, what, allowed?)
                               ├─► feature modules ─► AI gateway ─► Claude
                               └─► Supabase (data with per-user locks, private files)
Stripe ─► webhook ─► entitlements        Daily cron ─► alerts ─► email
```

Each split gives one job one home: identity in the wrapper, spending in the AI gateway,
quantities in the fridge ledger, Pro in billing, and all data in one database.

## How we will know it works

- Receipts: the lines Cooky accepts on its own are almost always right, and it asks about few
  enough lines that logging stays faster than typing.
- Shopping lists match hand-computed answers exactly.
- No plan ever breaks an exclusion, an allergy or the budget; impossible requests say so.
- The cooking assistant finds the right step, cites it, and admits when the recipe does not
  cover the question.
- After the full scripted journey, the fridge record matches what really happened.
- Every guardrail stops its bad cases without blocking normal use; every billing scenario
  passes.
- Fast enough on the deployed app that nobody wonders whether it froze, and cheap enough per
  feature to make sense against the Pro price.
- A small user pilot: less over-buying and less time planning than doing it by hand.

Every one of these is a key in `spec/targets.json`, measured as the proof section of
[`SPEC.md`](SPEC.md) describes.

## What ships first (v1)

The core loop and nothing else: sign up and pay in test mode, plan meals from the fridge with an
exact shopping list, scan a receipt into the fridge (food Cooky doesn't know is stocked by
category), see what expires first and what you can cook now, cook with the assistant, and
confirm what you used. Recipe import from links, email alerts, the weekly fridge check and a
user pilot come after. Every AI feature runs on a small, inexpensive model, because code already
does the parts that must be exact.

## What is out, and the cut

Out: live store prices and grocery ordering, food-safety and nutrition advice, native apps,
shared household accounts, multiple regions or currencies, real payments.

**The cut:** the earlier proposal's private photo gallery of finished dishes. It served neither
user pain. That effort moved to receipt scanning and the virtual fridge, which serve both.

**The business question:** a one-time Pro price does not cover the ongoing model cost of an
active user. At the cost caps an active week costs at most about US$0.19 in model calls, so the
price should become a subscription, with cheaper models where evals allow.

## Where to go next

Builders: [`TECHNICAL.md`](TECHNICAL.md), then [`AGENTS.md`](../AGENTS.md). Design reasoning:
[`DESIGN.md`](DESIGN.md). Every requirement:
[`SPEC.md`](SPEC.md).
