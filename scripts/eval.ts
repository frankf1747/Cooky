// Evals, one per AI unit or deterministic piece (SPEC §13.1). Cases live in eval/smoke/<set>/cases.json
// (v1) and eval/reference/<set>/{dev,test}/ (v2). Owners implement their set's runner here.
//   npm run eval -- <set> [--split dev|test]
import { existsSync, readdirSync } from "node:fs";

const set = process.argv[2];
const sets = existsSync("eval/smoke") ? readdirSync("eval/smoke").filter((d) => !d.includes(".")) : [];
if (!set || !sets.includes(set)) {
  console.log(`eval: choose a set: ${sets.join(", ")}`);
  process.exit(2);
}
if (set === "receipts") {
  import("../src/modules/receipts/eval-run")
    .then((m) => m.runReceiptsEval())
    .then((code) => process.exit(code), (err) => (console.error(err), process.exit(1)));
} else {
  console.log(`eval: no runner for "${set}" yet. Its owner adds one here (see eval/README.md).`);
  process.exit(1);
}
