// Owner: Platform. Journey step 1: tell Cooky who you cook for, once (SPEC ACC3). The first time
// Bao meets you, so it says hello; then a short form in four groups.
import targets from "@spec/targets.json";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { profileFormData } from "@/modules/account";
import { BaoSays } from "@/ui/Bao";
import { ProfileForm } from "@/ui/ProfileForm";
import { Page } from "@/ui/Page";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await profileFormData(user.id);
  return (
    <Page kicker="Set up · about a minute" title="Welcome to Cooky" width="narrow">
      <BaoSays mood="welcoming" pose="wave" motion="breathe" size={88} className="rise-in mb-12">
        Tell me once who you cook for and what you never eat. Every plan uses it, and staples never land on a shopping list. You can change any of it later.
      </BaoSays>
      <ProfileForm data={data} limits={{ servingsMin: targets.limits.servingsMin, servingsMax: targets.limits.servingsMax }} mode="onboarding" />
    </Page>
  );
}
