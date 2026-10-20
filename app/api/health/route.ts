// Owner: Platform. What is live (SPEC PLT4). Public, no secrets, free strings rather than enums.
import type { Health } from "@spec/contract";
import pkg from "../../../package.json";
import { config } from "@/platform/config";
import { systemWriter } from "@/platform/db";
import { route } from "@/platform/handler";

async function probe(fn: () => PromiseLike<{ error: { message: string } | null }>): Promise<string> {
  try {
    const { error } = await fn();
    return error ? `error: ${error.message}` : "ok";
  } catch (err) {
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// GET /api/health · v1 · SPEC PLT4
export const GET = route({
  auth: "public",
  handler: async (): Promise<Health> => {
    const c = config();
    const db = await probe(() => systemWriter().from("category_defaults").select("category", { head: true, count: "exact" }));
    const storage = await probe(() => systemWriter().storage.getBucket("receipts"));
    const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
    return {
      status: db === "ok" && storage === "ok" ? "ok" : "degraded",
      version: sha ? `${pkg.version}+${sha}` : pkg.version,
      model: c.aiMode === "live" ? c.models.default : "fake",
      aiMode: c.aiMode,
      db,
      stripeMode: c.stripeMode,
      storage,
    };
  },
});
