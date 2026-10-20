// Check 2 (smoke): real requests against a running Cooky (local or a preview deployment).
//   npm run smoke -- --base-url https://cooky-git-branch.vercel.app
// Day one: /api/health is 200 and every protected route answers 401 without a session.
// As features land, owners add signed-in cases here. Exit 0 pass, 2 fail.
import { routes } from "../spec/routes";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const base = (arg("base-url") ?? process.env.BASE_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.log("smoke: pass --base-url <url> (or set BASE_URL)");
  process.exit(2);
}

const fill = (path: string) => path.replace(/\[(\w+)\]/g, (_m, k: string) => (k === "recipeId" ? "rcp_smoke" : "smoke_id"));
const failures: string[] = [];

async function main() {
  const health = await fetch(`${base}/api/health`);
  const body = (await health.json().catch(() => ({}))) as { status?: string; db?: string };
  console.log(`GET /api/health -> ${health.status} ${JSON.stringify(body)}`);
  if (health.status !== 200 || body.status !== "ok") failures.push(`/api/health: ${health.status} ${body.status ?? ""} db=${body.db ?? "?"}`);

  for (const r of routes.filter((x) => x.v === 1 && x.auth !== "public")) {
    const res = await fetch(`${base}${fill(r.path)}`, { method: r.method, headers: { "content-type": "application/json" }, body: r.method === "GET" ? undefined : "{}" });
    const expected = r.auth === "stripe" ? [400, 501] : [401];
    const ok = expected.includes(res.status) && Boolean(res.headers.get("x-request-id"));
    console.log(`${ok ? "ok  " : "FAIL"} ${r.method} ${r.path} -> ${res.status} (expected ${expected.join(" or ")}, unauthenticated)`);
    if (!ok) failures.push(`${r.method} ${r.path}: ${res.status}`);
  }

  console.log(failures.length ? `smoke: ${failures.length} failure(s)` : "smoke: pass");
  process.exit(failures.length ? 2 : 0);
}
void main();
