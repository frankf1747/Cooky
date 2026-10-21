// Owner: Platform. Journey step 1: tell Cooky who you cook for, once (SPEC ACC3).
import targets from "@spec/targets.json";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { profileFormData } from "@/modules/account";
import { ProfileForm } from "@/ui/ProfileForm";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await profileFormData(user.id);
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Cooky</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Tell Cooky once who you cook for and what you never eat. Every plan uses it, and staples never land on a shopping list.
        You can change any of it later in Settings.
      </p>
      <ProfileForm data={data} limits={{ servingsMin: targets.limits.servingsMin, servingsMax: targets.limits.servingsMax }} mode="onboarding" />
    </section>
  );
}
