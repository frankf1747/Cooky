// Owner: Plan & Shop. Confirmed preferences and AI proposals (SPEC §5.9).
import type { z } from "zod";
import type { Preference, PreferenceCreate, PreferencePatch, PreferenceProposal } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function list(userId: string): Promise<{ items: Preference[] }> {
  void userId;
  throw notImplemented("preferences.list");
}

export async function create(userId: string, input: z.infer<typeof PreferenceCreate>): Promise<{ preferenceId: string | null }> {
  void userId;
  void input;
  throw notImplemented("preferences.create");
}

export async function update(userId: string, preferenceId: string, input: z.infer<typeof PreferencePatch>): Promise<Preference> {
  void userId;
  void preferenceId;
  void input;
  throw notImplemented("preferences.update");
}

export async function remove(userId: string, preferenceId: string): Promise<void> {
  void userId;
  void preferenceId;
  throw notImplemented("preferences.remove");
}

/** Join used by planning.swapMeal and cook.confirm: turn the user's words into proposals (never saved). */
export async function propose(userId: string, text: string, context: { recipeId: string | null; requestId: string }): Promise<PreferenceProposal[]> {
  void userId;
  void text;
  void context;
  throw notImplemented("preferences.propose");
}
