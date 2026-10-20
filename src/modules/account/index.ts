// Owner: Platform. Profile and account summary (SPEC ACC3, ACC4).
import type { Me, Profile } from "@spec/contract";
import { notImplemented } from "@/platform/errors";

export async function me(userId: string, email: string): Promise<Me> {
  void userId;
  void email;
  throw notImplemented("account.me");
}

export async function saveProfile(userId: string, profile: Profile): Promise<Profile> {
  void userId;
  void profile;
  throw notImplemented("account.saveProfile");
}
