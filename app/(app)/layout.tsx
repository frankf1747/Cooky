// Every signed-in page. No session → /login. Identity for data still comes from route() on each API call.
import { redirect } from "next/navigation";
import { getSessionUser, isPro } from "@/platform/auth";
import { AppNav } from "@/ui/AppNav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const pro = await isPro(user.id);
  return (
    <>
      <AppNav email={user.email} pro={pro} />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
