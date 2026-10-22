# Fridge v1 handoff

## Implemented

- User-scoped inventory, separate purchase batches, manual catalog/generic additions, search and category/location/reference-date filters.
- Expiring-soon attention list; deterministic Cook now coverage and missing ingredient names. Attention items link to a recipe that uses them and offer a reviewed freezer move when a guide exists.
- FRG4 item editor: absolute quantity (including zero), storage location and explicit reference date. Completion actions and edits use `edit_fridge_item` with `expectedQty` and an `edt:` idempotency key.
- The SQL transaction checks stock under lock, records ledger events and refuses stale quantities with 409. The browser refreshes conflicts and requires a new confirmation. Network retries preserve their operation key.
- Moves recompute an automatic guide from the destination shelf life; user-set dates stay unchanged unless explicitly replaced. If a destination has no guide but the item has an automatic date, the UI requires an explicit replacement rather than retaining a misleading old guide. An item with no date can still move without inventing one.
- Replay returns the original persisted edit fields, including after later edits or completion. The server-only replay lookup is scoped to the session user and exact key; item ownership is checked before the lookup.
- All relative/addition batches use `apply_inventory_batch`, now passing the user's local date from shared `localToday`. Insufficient stock uses the exact locked `error.details` values, not a later stock snapshot.
- Shared zinc styling with dark variants. Typical storage guides retain their sources and never certify food safety. Date inputs listen to input/change so the browser's date value and preview stay aligned.

No shared contract, migration, dependency, environment file or another owner's module was changed.

## Verification

Fridge module tests cover exact response schemas, owner isolation, separate batches, retries, invalid dates/units, date sources, filters, recipe matching, FEFO deduction proposals, atomic edit wiring, zero quantity, combined edits, inactive errors, mocked concurrent quantity changes and replay after completion. These mocks test module behavior; they do not replace Platform's SQL tests.

Signed-in hosted-dev browser checks on the user's test account:

1. Added chicken breast, 600 g; local added date displayed correctly.
2. Changed to 400 g and moved to freezer; guide changed to the catalog's freezer date.
3. Set a custom reference date; it persisted after saving.
4. Changed to 300 g and moved back to fridge; custom date stayed unchanged.
5. Submitted 350 g from a second tab still showing 400 g; API returned a conflict, browser refreshed to 300 g and did not overwrite stock.

The development server now uses `npm run dev:hosted -- --no-server-fast-refresh`. Default server fast refresh repeatedly reloaded in this environment. Webpack was tried but this repo only wires Tailwind through its Turbopack loader, so webpack leaves the UI unstyled. Turbopack with server fast refresh disabled renders correctly without editing shared config.

Final verification: `npm run check` passed (lint, typecheck, static); contract check passed (39 routes); `npm test` passed (39 files, 387 tests, including 29 Fridge tests); localhost smoke passed. The real hosted edit/conflict flow passed as described above. The test chicken batch was marked used successfully at the end.

## Remaining integration/verification

- Run Platform's SQL tests and the full gate with local Supabase/Docker. They were unavailable in this environment; no database gate pass is claimed.
- Webpack-generated route types exposed TS2344 for the existing shared handler's optional RouteContext argument. This was observed only in the webpack experiment; the final Turbopack type generation and complete `npm run check` pass. No shared handler or generated type was edited.
- The original shared POST route still always returns 201 for manual add, including a retry; SPEC expects 200 on replay. The route was kept unchanged per the module workflow. Coordinate a replay-aware response adapter with Platform; the existing add result shape has only itemId. No repeated addition is written.
- `proposeDeductions` cannot represent a completely missing ingredient because the current Deduction requires an itemId. Cook already owns the missing-ingredient review and correction flow.
- FRG6 weekly check and FRG7 waste statistics remain explicit 501 (v2 per SPEC §0).
- A teammate must verify on a deployment before merging. Changes are committed and pushed on the Fridge feature branch for a draft PR; no deployment or merge into main was performed.

Latest main UI integration: preserved the shared Page layout and compact inventory rows from Platform, added the editor/conflict guards to those rows, and imported shared field/button styles. Post-integration checks: 41 test files / 405 tests passed; contract remains 39 routes.
