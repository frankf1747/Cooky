# Rules — Cooky

Append only. Never renumber. Every rule has a check and a precedent; a precedent is a real
incident (date, what broke, what it cost) or `TODO` until one happens. Never invent one.

### F1 · Dependency failures surface as errors
- **Rule:** a failed model, database, Stripe or email call ends the request with an error status and the run with `terminated: "error"`. Never a fallback answer from a `catch`.
- **Check:** `check:runs`: any step with `ok: false` and no `error` fails; any run with an errored step and `terminated: "done"` fails. `smoke` with `AI_MODE=fake` failing fixtures expects `502`.
- **Precedent:** TODO

### B1 · Runs end honestly
- **Rule:** a run that hits a cap in `spec/targets.json` → `budgets` ends `terminated: "cap"` and the user sees an error, not a partial result shown as complete.
- **Check:** `check:runs`: any run over a budget with `terminated: "done"` fails.
- **Precedent:** TODO

### G1 · Outputs are grounded
- **Rule:** every id in an AI output (ingredient, recipe, chunk, preference, fridge item) was supplied to that same run; every cooking-assistant citation was retrieved in that run.
- **Check:** `eval:cook` citation validity and `eval:plan` / `eval:receipts` id validation must be 1.0; G7 and G9 cases in `eval:guard`.
- **Precedent:** TODO

### E1 · Evidence before "done"
- **Rule:** nothing is called done until the ordered checks pass against the deployed system and a person has read one successful and one failing run end to end.
- **Check:** `npm run gate` exit code; the two run ids recorded in the write-up.
- **Precedent:** TODO

### M1 · The model never does arithmetic or writes records
- **Rule:** quantities, packages, prices and dates come from code; fridge, preferences and entitlements change only through confirm endpoints and billing.
- **Check:** `eval:calc` exact match; `journey` asserts the ledger is unchanged after every AI endpoint; `check:static` flags writes to those tables outside their owning modules.
- **Precedent:** TODO

### P1 · Personal data stays out of logs and prompts it does not need
- **Rule:** logs and run records hold ids and hashes, not emails, raw receipt text or images; receipt images are deleted after confirm.
- **Check:** `check:runs` scans for email and long digit patterns; `scn:authz` confirms confirmed receipts have no stored image.
- **Precedent:** TODO

### T1 · Targets are declared before runs
- **Rule:** a value in `spec/targets.json` changes only with a written reason and date in its note, never to make a run pass.
- **Check:** CI fails if `spec/targets.json` changes without a matching note change; reviewed by the Proof owner.
- **Precedent:** TODO
