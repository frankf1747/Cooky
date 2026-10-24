// Every API route in SPEC §8.2, with who owns it and whether it is in the v1 release.
// The skeleton creates one route file per entry; `npm run check:contract` keeps them in sync.

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
/** public: anyone · user: signed in · pro: signed in with Pro · cron: CRON_SECRET · stripe: signed webhook */
export type Auth = "public" | "user" | "pro" | "cron" | "stripe";
export type Owner = "platform" | "recipes-cook" | "plan-shop" | "receipts" | "fridge";

export type RouteDef = {
  method: Method;
  /** URL path, e.g. /api/plans/[id]/swap */
  path: string;
  auth: Auth;
  owner: Owner;
  v: 1 | 2;
  /** SPEC requirement ids this route serves */
  spec: string;
};

export const routes: RouteDef[] = [
  { method: "GET", path: "/api/health", auth: "public", owner: "platform", v: 1, spec: "PLT4" },
  { method: "GET", path: "/api/me", auth: "user", owner: "platform", v: 1, spec: "ACC4" },
  { method: "PUT", path: "/api/profile", auth: "user", owner: "platform", v: 1, spec: "ACC3" },

  { method: "GET", path: "/api/ingredients", auth: "user", owner: "recipes-cook", v: 1, spec: "RCP2" },
  { method: "POST", path: "/api/ingredients", auth: "user", owner: "recipes-cook", v: 2, spec: "RCP9" },
  { method: "GET", path: "/api/recipes", auth: "user", owner: "recipes-cook", v: 1, spec: "RCP3" },
  { method: "POST", path: "/api/recipes", auth: "user", owner: "recipes-cook", v: 2, spec: "RCP6" },
  { method: "GET", path: "/api/recipes/[id]", auth: "user", owner: "recipes-cook", v: 1, spec: "RCP3" },
  { method: "DELETE", path: "/api/recipes/[id]", auth: "user", owner: "recipes-cook", v: 2, spec: "RCP3" },
  { method: "POST", path: "/api/recipes/import", auth: "pro", owner: "recipes-cook", v: 2, spec: "RCP4-RCP7" },

  // Plans: Free users get one plan (quota checked inside the module), so the route is "user".
  { method: "POST", path: "/api/plans", auth: "user", owner: "plan-shop", v: 1, spec: "PLN1-PLN6" },
  { method: "GET", path: "/api/plans", auth: "user", owner: "plan-shop", v: 1, spec: "PLN8" },
  { method: "GET", path: "/api/plans/[id]", auth: "user", owner: "plan-shop", v: 1, spec: "PLN8" },
  { method: "POST", path: "/api/plans/[id]/swap", auth: "pro", owner: "plan-shop", v: 1, spec: "PLN7" },
  { method: "POST", path: "/api/plans/[id]/save", auth: "user", owner: "plan-shop", v: 1, spec: "PLN6" },
  { method: "PATCH", path: "/api/plans/[id]/checklist", auth: "user", owner: "plan-shop", v: 2, spec: "PLN9" },

  { method: "GET", path: "/api/preferences", auth: "user", owner: "plan-shop", v: 1, spec: "LRN3" },
  { method: "POST", path: "/api/preferences", auth: "user", owner: "plan-shop", v: 1, spec: "LRN2" },
  { method: "PATCH", path: "/api/preferences/[id]", auth: "user", owner: "plan-shop", v: 1, spec: "LRN3" },
  { method: "DELETE", path: "/api/preferences/[id]", auth: "user", owner: "plan-shop", v: 1, spec: "LRN3" },

  { method: "POST", path: "/api/receipts", auth: "pro", owner: "receipts", v: 1, spec: "RCT1-RCT4" },
  { method: "GET", path: "/api/receipts/[id]", auth: "user", owner: "receipts", v: 1, spec: "RCT2" },
  { method: "DELETE", path: "/api/receipts/[id]", auth: "user", owner: "receipts", v: 1, spec: "RCT9" },
  { method: "POST", path: "/api/receipts/[id]/retry", auth: "pro", owner: "receipts", v: 1, spec: "RCT7" },
  { method: "POST", path: "/api/receipts/[id]/confirm", auth: "user", owner: "receipts", v: 1, spec: "RCT6" },

  { method: "GET", path: "/api/fridge", auth: "user", owner: "fridge", v: 1, spec: "FRG3" },
  { method: "POST", path: "/api/fridge/items", auth: "user", owner: "fridge", v: 1, spec: "FRG4" },
  { method: "PATCH", path: "/api/fridge/items/[id]", auth: "user", owner: "fridge", v: 1, spec: "FRG4" },
  { method: "POST", path: "/api/fridge/check", auth: "user", owner: "fridge", v: 2, spec: "FRG6" },
  { method: "GET", path: "/api/stats", auth: "user", owner: "fridge", v: 2, spec: "FRG7" },

  { method: "POST", path: "/api/cook/[recipeId]/ask", auth: "pro", owner: "recipes-cook", v: 1, spec: "ASK1-ASK5" },
  { method: "POST", path: "/api/cook/[recipeId]/done", auth: "user", owner: "recipes-cook", v: 1, spec: "CK2" },
  { method: "POST", path: "/api/cook/events/[id]/confirm", auth: "user", owner: "recipes-cook", v: 1, spec: "CK3" },

  { method: "GET", path: "/api/alerts", auth: "user", owner: "platform", v: 2, spec: "ALR3" },
  { method: "POST", path: "/api/alerts/[id]/dismiss", auth: "user", owner: "platform", v: 2, spec: "ALR3" },
  { method: "GET", path: "/api/cron/alerts", auth: "cron", owner: "platform", v: 2, spec: "ALR1, ALR5" },

  { method: "POST", path: "/api/billing/checkout", auth: "user", owner: "platform", v: 1, spec: "ACC5, ACC8" },
  { method: "GET", path: "/api/billing/entitlement", auth: "user", owner: "platform", v: 1, spec: "ACC7" },
  { method: "POST", path: "/api/stripe/webhook", auth: "stripe", owner: "platform", v: 1, spec: "ACC6" },
];

/** app/api/... folder for a route path: "/api/plans/[id]/swap" -> "app/api/plans/[id]/swap/route.ts" */
export const routeFile = (path: string) => `app${path}/route.ts`;
