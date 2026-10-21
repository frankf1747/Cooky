# Fridge MVP handoff

Implemented on `fridge/inventory`: own-user inventory view; separate purchase batches; catalog or generic manual add; mark used/tossed; date-reference labels and location filter; deterministic Cook now coverage; proposed cooking deductions (read-only). All quantity writes call the existing atomic `apply_inventory_batch` RPC. No AI calls, shared schema, routes, dependencies or secrets were changed.

## Pending Platform integration (Frank)

- `PATCH /api/fridge/items/:id` quantity, location and expiry-date changes deliberately return 501. The current RPC applies additive deltas only. It cannot atomically set an absolute quantity or edit metadata. A read-then-write delta races with another edit; do not implement a direct table update as a workaround.
- Extend the shared transaction to accept an expected quantity/version (reject stale stock with 409), atomic absolute edits, and metadata edits. Preserve user ownership, ledger events, non-negative quantities and exactly-once batch semantics in the same transaction. Save the original operation response for retries before reading current item state.
- Completion also currently reads stock before calling the additive RPC; concurrent changes can reject the action or leave residual stock. Extend the same CAS/atomic completion transaction to mark-used/tossed before multi-instance production use.
- Freezer moves must recalculate the typical date from the freezer shelf life, unless the date was user-set. Test moves, explicit dates, two simultaneous edits, edit versus cook deductions, and replay after subsequent stock changes.
- Current insufficient-stock errors include a numeric shortfall based on a new user-scoped stock snapshot, explicitly labelled `shortfallBasis: current_stock_snapshot`. The RPC must report the exact locked transaction shortfall to remove this race in diagnostics.
- The shared POST route always emits 201; SPEC asks for 200 on replay. Fridge's current return shape cannot signal that distinction. Platform should coordinate replay response/status without changing the public schema unilaterally.
- `proposeDeductions` can report a shortfall on the final allocation for a partially stocked ingredient. Completely absent stock cannot be represented as a Deduction because itemId is required. Cook must compare recipe requirements with the proposed list and require user correction before confirmation.
- The current RPC sets added_on using DB current_date (UTC), while the expiry guide uses the profile timezone. Align added_on with the user timezone in the transaction; the browser test showed Oct 21 versus local Oct 20.
- Shared seed shelf-life sources contain placeholders. Data & Proof must replace these with sourced guides before final submission. The UI exposes the actual source and does not describe dates as safety assessments.

## Verification

Run `npm run check`, `npm run check:contract`, `npm test`. Fridge has 18 tests covering ownership, batches/retries, dates, generic stock, ranking, deductions, errors and explicit unsupported edits. Unit mocks verify application wiring, not SQL atomicity. Run the repo's database tests and the gate against a preview before merging; a teammate must verify.

In a signed-in browser at `/fridge`: add a catalog ingredient; refresh and verify one new batch; add unmatched food; verify it does not satisfy ingredient coverage; mark the test batch used; refresh and verify it disappears. Confirm dates say typical guide and display sources. Recipe detail destinations are owned by Recipes & Cook and may remain placeholders until that module lands.

No push, deploy or merge has been performed.

## Verification observed on local hosted dev

`npm run check` passed; contract check via `node --import tsx scripts/check-contract.ts` passed (39 routes); `npm test` passed (15 files, 127 tests); unauthenticated smoke passed against localhost:3000 (db/storage ok, AI fake). Signed-in browser: added 6 eggs, reloaded, verified one persisted batch and recipe coverage increasing from 0% to 25%. Browser-native confirmation stalled the automation; replaced it with inline confirmation. Completion is unit-tested; the final browser completion flow still needs a teammate click-through. No full gate/database-test or preview verification is claimed.

## Usability additions

Added client-side search, combined category/location/reference-date filters, clickable inventory summary counts, missing ingredient names on recipe cards, receipt-entry link, and a live date/source preview before adding food. The server creation path and browser preview use the same pure helper. No changes to the shared contract or database.

Verification: lint/types/static checks passed; contract check passed (39 routes); full test suite passed (16 files, 132 tests, including 18 Fridge tests). Browser click-through verified generic food creation, empty-search messaging, clearing filters, inline used/discard confirmation, and successful stock removal for both actions. Test purchases remain auditable ledger records; they are not physically deleted. Platform completion concurrency limitations still apply.
