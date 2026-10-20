import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routeFile, routes } from "./routes";

describe("route registry", () => {
  it.each(routes.map((r) => [`${r.method} ${r.path}`, r] as const))("%s has a route file exporting its method", (_name, r) => {
    const file = routeFile(r.path);
    expect(existsSync(file), `${file} is missing`).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(new RegExp(`export const ${r.method} = route\\(`));
  });

  it("declares each route's auth level in its file", () => {
    for (const r of routes) {
      const src = readFileSync(routeFile(r.path), "utf8");
      const block = src.slice(src.indexOf(`export const ${r.method} = route(`));
      expect(block, `${r.method} ${r.path}`).toMatch(new RegExp(`auth: "${r.auth}"`));
    }
  });
});
