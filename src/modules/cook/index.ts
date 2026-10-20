// Owner: Recipes & Cook. Cook mode, deductions and the cooking assistant (SPEC §5.6, §5.7).
import type { z } from "zod";
import type { CookAnswer, CookAsk, CookConfirm, CookConfirmResponse, CookDone, CookDoneResponse } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function ask(userId: string, recipeId: string, input: z.infer<typeof CookAsk>, requestId: string): Promise<CookAnswer> {
  void userId;
  void recipeId;
  void input;
  void requestId;
  throw notImplemented("cook.ask");
}

export async function done(userId: string, recipeId: string, input: z.infer<typeof CookDone>): Promise<z.infer<typeof CookDoneResponse>> {
  void userId;
  void recipeId;
  void input;
  throw notImplemented("cook.done");
}

export async function confirm(userId: string, cookEventId: string, input: z.infer<typeof CookConfirm>, requestId: string): Promise<z.infer<typeof CookConfirmResponse>> {
  void userId;
  void cookEventId;
  void input;
  void requestId;
  throw notImplemented("cook.confirm");
}
