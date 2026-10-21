## What and why

<!-- One or two sentences. Which SPEC ids does this deliver? e.g. PLN3, PLN2 -->

## How I checked it

- [ ] `npm run gate -- --upto 2 --base-url http://localhost:3000` → paste the last line:
- [ ] Clicked through the changed page(s) as a fresh user: loading, empty, error and retry states
- [ ] New module functions have tests next to them; AI units were run on their eval cases

## Rules (AGENTS.md)

- [ ] Only files in folders I own (or the owner approved)
- [ ] No change to `spec/contract.ts`, `supabase/migrations/`, `package.json` or `spec/targets.json` without Platform / Data & Proof approval
- [ ] No secrets, no `.env*` files except `.example`
- [ ] Rebased on the latest `main`
