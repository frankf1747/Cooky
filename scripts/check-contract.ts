// Check 1 (contract): the pieces every module builds against still agree with each other.
//   - every route in spec/routes.ts has a route file exporting that method, and no route file is unregistered
//   - spec/targets.json is coherent (positive budgets, shares in 0..1, a note per target)
//   - seed CSV headers match the columns documented in supabase/seed/README.md
// Exit 0 clean, 2 on any error.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import targets from "../spec/targets.json";
import { routeFile, routes } from "../spec/routes";

const errors: string[] = [];

// ---- routes <-> files
for (const r of routes) {
  const file = routeFile(r.path);
  if (!existsSync(file)) {
    errors.push(`${r.method} ${r.path}: missing ${file}`);
    continue;
  }
  const src = readFileSync(file, "utf8");
  if (!new RegExp(`export\\s+(const|async function|function)\\s+${r.method}\\b`).test(src))
    errors.push(`${r.method} ${r.path}: ${file} does not export ${r.method}`);
}
const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : n === "route.ts" ? [p] : [];
      });
const registered = new Set(routes.map((r) => routeFile(r.path)));
for (const f of walk("app/api")) if (!registered.has(f)) errors.push(`${f}: route file not in spec/routes.ts`);

// ---- targets
const t = targets.targets as Record<string, number>;
const notes = targets.notes as Record<string, string>;
for (const [k, v] of Object.entries(t)) {
  if (typeof v !== "number" || !Number.isFinite(v)) errors.push(`targets.${k} is not a number`);
  const share = /(rate|recall|precision|accuracy|faithfulness)/.test(k) && !/_pct$/.test(k);
  if (share && (v < 0 || v > 1)) errors.push(`targets.${k}=${v} must be in 0..1`);
  if (!notes[k]) errors.push(`targets.${k} has no note`);
}
for (const [unit, b] of Object.entries(targets.budgets))
  for (const [k, v] of Object.entries(b)) if (!(typeof v === "number" && v > 0)) errors.push(`budgets.${unit}.${k} must be > 0`);
for (const k of targets.measuredIn.v1) if (!(k in t)) errors.push(`measuredIn.v1 names unknown target ${k}`);

// ---- seed CSV headers
const readme = existsSync("supabase/seed/README.md") ? readFileSync("supabase/seed/README.md", "utf8") : "";
for (const m of readme.matchAll(/^### `(\w+\.csv)`\n+Columns: `([^`]+)`/gm)) {
  const [, file, cols] = m;
  const path = `supabase/seed/${file}`;
  if (!existsSync(path)) {
    errors.push(`${path}: documented in supabase/seed/README.md but missing`);
    continue;
  }
  const header = readFileSync(path, "utf8").split(/\r?\n/)[0].trim();
  if (header !== cols.trim()) errors.push(`${path}: header "${header}" != documented "${cols.trim()}"`);
}

for (const e of errors) console.log(`ERROR ${e}`);
console.log(errors.length ? `check-contract: ${errors.length} error(s)` : `check-contract: clean (${routes.length} routes)`);
process.exit(errors.length ? 2 : 0);
