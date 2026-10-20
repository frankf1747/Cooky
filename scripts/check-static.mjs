#!/usr/bin/env node
// Check 0 (static): the repo-wide rules a linter cannot see. Exit 0 clean, 2 on any finding.
//   - only src/platform/ai.ts imports @anthropic-ai/sdk
//   - only src/modules/billing/ imports stripe
//   - no secret-looking strings in files git would commit
//   - no NEXT_PUBLIC_ variable that looks secret
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.startsWith("node_modules/"));

const findings = [];
const code = files.filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
const text = files.filter((f) => /\.(ts|tsx|js|mjs|cjs|json|md|sql|toml|yml|yaml|csv|example)$/.test(f) || f.startsWith(".env"));

const importOf = (pkg) => new RegExp(`(from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)["']${pkg}(/[^"']*)?["']`);

for (const f of code) {
  const src = readFileSync(f, "utf8");
  if (importOf("@anthropic-ai/sdk").test(src) && f !== "src/platform/ai.ts")
    findings.push(`${f}: imports @anthropic-ai/sdk; only src/platform/ai.ts may (AGENTS.md)`);
  if (importOf("stripe").test(src) && !f.startsWith("src/modules/billing/"))
    findings.push(`${f}: imports stripe; only src/modules/billing/ may (AGENTS.md)`);
}

const secretPatterns = [
  [/sk_live_[A-Za-z0-9]{8,}/, "live Stripe key"],
  [/sk_test_[A-Za-z0-9]{16,}/, "Stripe test secret key"],
  [/whsec_[A-Za-z0-9]{16,}/, "Stripe webhook secret"],
  [/sk-ant-[A-Za-z0-9_-]{16,}/, "Anthropic API key"],
  [/sb_secret_[A-Za-z0-9_-]{8,}/, "Supabase secret key"],
  [/re_[A-Za-z0-9]{20,}/, "Resend API key"],
];
for (const f of text) {
  if (f === "scripts/check-static.mjs") continue;
  let src;
  try {
    src = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const [re, what] of secretPatterns) if (re.test(src)) findings.push(`${f}: looks like a ${what}; secrets live only in env vars`);
  for (const m of src.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
    const name = m[0];
    if (/SECRET|PRIVATE|SERVICE_ROLE/.test(name) || (/KEY/.test(name) && name !== "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
      findings.push(`${f}: ${name} would ship a secret to the browser`);
  }
}

for (const line of findings) console.log(`ERROR ${line}`);
console.log(findings.length ? `check-static: ${findings.length} finding(s)` : "check-static: clean");
process.exit(findings.length ? 2 : 0);
