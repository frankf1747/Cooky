// Owner: Platform. Change the onboarding answers later (SPEC ACC3), and the password.
import targets from "@spec/targets.json";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { profileFormData } from "@/modules/account";
import { ChangePasswordForm } from "@/ui/ChangePasswordForm";
import { ProfileForm } from "@/ui/ProfileForm";
import { Page, Section } from "@/ui/Page";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await profileFormData(user.id);
  return (
    <Page kicker="Your account" title="Settings" description="What every new plan starts from." width="narrow">
      <ProfileForm data={data} limits={{ servingsMin: targets.limits.servingsMin, servingsMax: targets.limits.servingsMax }} mode="settings" />

      <Section title="Password" note={<>Signed in as {user.email}.</>} className="!mt-16 border-t border-line pt-10">
        <ChangePasswordForm email={user.email} />
      </Section>
    </Page>
  );
}
