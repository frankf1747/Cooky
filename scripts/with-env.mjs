#!/usr/bin/env node
// Run a command with an env file loaded first, e.g. the shared hosted database:
//   node scripts/with-env.mjs .env.hosted next dev
// Variables already in process.env win over the file, and Next.js does not override them with .env.local.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const [file, cmd, ...args] = process.argv.slice(2);
if (!file || !cmd) {
  console.log("usage: node scripts/with-env.mjs <env file> <command> [args...]");
  process.exit(2);
}
if (!existsSync(file)) {
  console.log(`with-env: ${file} not found (copy ${file}.example and fill it in)`);
  process.exit(2);
}
process.loadEnvFile(file);
const child = spawn(cmd, args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
