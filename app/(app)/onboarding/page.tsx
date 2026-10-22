// Owner: Platform. Journey step 1: tell Cooky who you cook for, once (SPEC ACC3). The first time
// Bao meets you: four short steps (household, foods you never eat, staples, timezone), one at a
// time, with Bao saying what each is for. Everything can be changed later in Settings.
import targets from "@spec/targets.json";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { profileFormData } from "@/modules/account";
import { ProfileForm } from "@/ui/ProfileForm";
import { Page } from "@/ui/Page";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await profileFormData(user.id);
  return (
    <Page kicker="Set up · about a minute" title="Welcome to Cooky" description="Four quick questions, and Bao plans around the answers. Change any of it later." width="narrow">
      <ProfileForm data={data} limits={{ servingsMin: targets.limits.servingsMin, servingsMax: targets.limits.servingsMax }} mode="onboarding" />
    </Page>
  );
}
