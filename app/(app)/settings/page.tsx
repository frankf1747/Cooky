// Owner: Platform. Change the onboarding answers later (SPEC ACC3), the password, and how Cooky
// looks on this device. Grouped like a phone's settings: who you are, how it looks, what every
// plan starts from, then security.
import targets from "@spec/targets.json";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretRight, Lock, PaintBrush } from "@phosphor-icons/react/ssr";
import { getSessionUser, isPro } from "@/platform/auth";
import { profileFormData } from "@/modules/account";
import { ChangePasswordForm } from "@/ui/ChangePasswordForm";
import { Page } from "@/ui/Page";
import { ProfileForm, SettingsCard } from "@/ui/ProfileForm";
import { SignOutButton } from "@/ui/SignOutButton";
import { kicker, tagNeutral, tagPro } from "@/ui/styles";
import { ThemeSwitch } from "@/ui/ThemeSwitch";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className={`${kicker} mb-3 px-1`}>{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [data, pro] = await Promise.all([profileFormData(user.id), isPro(user.id)]);
  const initial = (user.email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <Page kicker="Your account" title="Settings" description="How Cooky plans for you, and how it looks." width="narrow">
      {/* who you are, and your plan */}
      <Link href="/billing" className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-crust-tint font-display text-xl font-semibold text-crust-ink">{initial}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{user.email}</span>
          <span className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span className={pro ? tagPro : tagNeutral}>{pro ? "Cooky Pro" : "Free plan"}</span>
            {pro ? "Manage your plan" : "Unlock Pro"}
          </span>
        </span>
        <CaretRight size={18} aria-hidden className="shrink-0 text-subtle transition group-hover:translate-x-0.5" />
      </Link>

      <div className="mt-10">
        <Group title="Appearance">
          <SettingsCard icon={<PaintBrush size={18} weight="bold" />} title="Theme" hint="System follows your device. Saved on this device.">
            <ThemeSwitch />
          </SettingsCard>
        </Group>

        <Group title="Planning">
          <ProfileForm data={data} limits={{ servingsMin: targets.limits.servingsMin, servingsMax: targets.limits.servingsMax }} mode="settings" />
        </Group>

        <Group title="Security">
          <details className="group rounded-2xl border border-line bg-surface">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cobalt-tint text-cobalt-ink"><Lock size={18} weight="bold" /></span>
              <span className="flex-1 text-[15px] font-medium">Change password</span>
              <CaretRight size={18} aria-hidden className="text-subtle transition group-open:rotate-90" />
            </summary>
            <div className="border-t border-line p-4 sm:p-5">
              <ChangePasswordForm email={user.email} />
            </div>
          </details>
          <SignOutButton />
        </Group>
      </div>
    </Page>
  );
}
