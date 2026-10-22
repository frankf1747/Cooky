// Owner: Platform. Change the onboarding answers later (SPEC ACC3).
import targets from "@spec/targets.json";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { profileFormData } from "@/modules/account";
import { ChangePasswordForm } from "@/ui/ChangePasswordForm";
import { ProfileForm } from "@/ui/ProfileForm";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await profileFormData(user.id);
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Your household, budget, foods you never eat, staples and timezone.</p>
      <ProfileForm data={data} limits={{ servingsMin: targets.limits.servingsMin, servingsMax: targets.limits.servingsMax }} mode="settings" />

      <h2 className="mt-12 text-lg font-semibold">Password</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Signed in as {user.email}.</p>
      <ChangePasswordForm email={user.email} />
    </section>
  );
}
