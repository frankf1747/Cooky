# Evaluation (owner: Data & Proof, with each feature owner)

v1 uses **smoke sets** in `eval/smoke/<set>/cases.json`: small, written before the code they
measure, enough to catch breakage and to show good and failed examples in the write-up. Sizes:
`workload.smokeSets` in `spec/targets.json`. Which targets the v1 gate checks: `measuredIn.v1`.
Run one with `npm run eval -- <set>`; results go to `eval/runs/` (gitignored). Rules learned the
hard way go in [`rules.md`](rules.md) (append-only).

| Set | Measures (keys in `spec/targets.json`) | Owner of the runner | One case looks like |
|---|---|---|---|
| `calc` | `min_shopping_calc_exact_rate` | Plan & Shop | `{ "recipes": ["rcp_…"], "servings": 2, "fridge": [{ "ingredientId": "ing_…", "qty": 200, "unit": "g" }], "expect": { "items": [{ "ingredientId": "ing_…", "packages": 2, "costCents": 1000, "leftoverQty": 300 }], "totalCents": 1000 } }` |
| `plans` | `min_plan_constraint_pass_rate`, `min_plan_success_rate`, `min_infeasible_honesty_rate` | Plan & Shop | `{ "input": { PlanCreate fields }, "fridge": [...], "preferences": [...], "forbiddenIngredientIds": ["ing_…"], "expectInfeasible": false }` |
| `receipts` | `min_receipt_auto_accept_precision`, `max_receipt_flag_rate`, `min_receipt_food_line_recall` | Receipts | `{ "image": "eval/smoke/receipts/r01.jpg", "lines": [{ "raw": "ORG BNLS CHKN BRST", "kind": "food", "ingredientId": "ing_chicken_breast", "qty": 598.74, "unit": "g" }] }` |
| `cook` | `min_cook_retrieval_recall_at_k`, `min_cook_citation_valid_rate`, `min_evidence_gap_honesty_rate` | Recipes & Cook | `{ "recipeId": "rcp_…", "question": "no wok?", "expectChunkIds": ["chk_…_f2"], "expectNotCovered": false }` |
| `guard` | `min_guardrail_block_rate`, `max_guardrail_false_block_rate` | Data & Proof | `{ "request": { "method": "POST", "path": "/api/…", "as": "userA", "body": {} }, "expectStatus": 404, "bad": true }` |

Receipt photos: blur card digits and loyalty numbers before committing. Write the expected answer
by hand before running anything; never copy it from the app's output.
