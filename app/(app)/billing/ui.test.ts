import { describe, expect, it } from "vitest";
import { billingErrorMessage, waitForPro } from "./ui";

describe("billing page helpers", () => {
  it("says plainly that nothing was charged when checkout fails, and offers a retry", () => {
    expect(billingErrorMessage(502, { code: "payment_error" })).toEqual({ message: expect.stringContaining("Nothing was charged"), retry: true });
    expect(billingErrorMessage(500, {})).toMatchObject({ retry: true });
  });
  it("does not offer a retry when retrying cannot help", () => {
    expect(billingErrorMessage(409, { code: "already_pro" }).retry).toBe(false);
    expect(billingErrorMessage(503, { code: "billing_unconfigured" }).retry).toBe(false);
  });
});

describe("waitForPro (ACC7)", () => {
  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => { t += ms; } };
  }

  it("polls every interval until the webhook has granted Pro", async () => {
    const c = clock();
    const answers = [{ plan: "free" as const, grantedAt: null }, null, { plan: "pro" as const, grantedAt: "2026-10-21T00:00:00Z" }];
    let calls = 0;
    const res = await waitForPro({ ...c, intervalMs: 2000, maxMs: 30_000, cancelled: () => false, check: async () => answers[calls++] });
    expect(res).toEqual({ plan: "pro", grantedAt: "2026-10-21T00:00:00Z" });
    expect(calls).toBe(3);
    expect(c.now()).toBe(4000);
  });

  it("gives up at the limit so the page can offer a manual refresh", async () => {
    const c = clock();
    let calls = 0;
    const res = await waitForPro({ ...c, intervalMs: 2000, maxMs: 30_000, cancelled: () => false, check: async () => (calls++, { plan: "free", grantedAt: null }) });
    expect(res).toBe("timeout");
    expect(calls).toBe(16);
  });

  it("stops when the page goes away", async () => {
    const c = clock();
    let calls = 0;
    const res = await waitForPro({ ...c, intervalMs: 2000, maxMs: 30_000, cancelled: () => calls >= 2, check: async () => (calls++, null) });
    expect(res).toBe("cancelled");
    expect(calls).toBe(2);
  });
});
