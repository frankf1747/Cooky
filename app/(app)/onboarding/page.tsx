// Owner: Platform. Journey step 1: tell Cooky who you cook for, once (SPEC ACC3).
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
    <Page
      title="Welcome to Cooky"
      description="Tell Cooky once who you cook for and what you never eat. Every plan uses it, and staples never land on a shopping list. You can change any of it later in Settings."
      width="narrow"
    >
      <ProfileForm data={data} limits={{ servingsMin: targets.limits.servingsMin, servingsMax: targets.limits.servingsMax }} mode="onboarding" />
    </Page>
  );
}
