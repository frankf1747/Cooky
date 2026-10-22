// Reached from the reset email via /auth/callback, which signed the user in with the link's code.
import { getSessionUser } from "@/platform/auth";
import { ResetPasswordForm } from "@/ui/PasswordResetForms";

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  return <ResetPasswordForm email={user?.email ?? null} />;
}
