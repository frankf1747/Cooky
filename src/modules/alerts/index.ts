// Owner: Platform. Rescue alerts (SPEC §5.8). v1 shows expiring items on the fridge page
// (fridge.expiringSoon); the alert list, daily cron and email are v2.
import type { z } from "zod";
import type { Alert } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function list(userId: string): Promise<{ items: z.infer<typeof Alert>[] }> {
  void userId;
  throw notImplemented("alerts.list (v2)");
}
export async function dismiss(userId: string, alertId: string): Promise<void> {
  void userId;
  void alertId;
  throw notImplemented("alerts.dismiss (v2)");
}
export async function runDaily(): Promise<{ usersScanned: number; alertsCreated: number; emailsSent: number; errors: string[] }> {
  throw notImplemented("alerts.runDaily (v2)");
}
