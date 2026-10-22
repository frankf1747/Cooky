import { ForgotPasswordForm } from "@/ui/PasswordResetForms";

export default async function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  const { error } = await props.searchParams;
  return <ForgotPasswordForm expired={error === "expired"} />;
}
