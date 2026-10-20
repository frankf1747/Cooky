// The ordered checks (SPEC §13.5). Each step blocks the next.
//   npm run gate -- --upto 2 --base-url "$PREVIEW_URL"   before merging
//   npm run gate -- --base-url "$PREVIEW_URL"            milestones: checks 0-4
// Exit 0 pass, 1 warnings only (a check not built yet), 2 failure.
import { spawnSync } from "node:child_process";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const upto = Number(arg("upto") ?? 4);
const base = arg("base-url") ?? process.env.BASE_URL;

type Step = { n: number; name: string; cmd?: string[]; todo?: string };
const steps: Step[] = [
  { n: 0, name: "static (lint, types, secrets, import rules)", cmd: ["npm", "run", "check"] },
  { n: 1, name: "contract (routes, targets, seed headers)", cmd: ["npm", "run", "check:contract"] },
  { n: 1, name: "unit tests", cmd: ["npm", "test"] },
  { n: 1, name: "database tests (access rule, quota, ledger; needs `npx supabase start`)", cmd: ["npx", "supabase", "test", "db"] },
  { n: 2, name: "smoke against the running app", cmd: base ? ["npm", "run", "smoke", "--", "--base-url", base] : undefined },
  { n: 3, name: "run hygiene", todo: "check:runs is not built yet (Data & Proof + Platform)" },
  { n: 4, name: "targets (evals, billing and authz scenarios, journey)", todo: "evals are not built yet (each owner adds theirs)" },
];

let warnings = 0;
for (const s of steps.filter((x) => x.n <= upto)) {
  if (s.todo) {
    console.log(`\n== check ${s.n}: ${s.name}\nWARN ${s.todo}`);
    warnings++;
    continue;
  }
  if (!s.cmd) {
    console.log(`\n== check ${s.n}: ${s.name}\nFAIL pass --base-url <url> to run smoke`);
    process.exit(2);
  }
  console.log(`\n== check ${s.n}: ${s.name}\n$ ${s.cmd.join(" ")}`);
  const r = spawnSync(s.cmd[0], s.cmd.slice(1), { stdio: "inherit" });
  if (r.status !== 0) {
    console.log(`\ngate: FAILED at check ${s.n} (${s.name})`);
    process.exit(2);
  }
}
console.log(warnings ? `\ngate: pass with ${warnings} warning(s)` : "\ngate: pass");
process.exit(warnings ? 1 : 0);
