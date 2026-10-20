// Every signed-in page. No session → /login. Identity for data still comes from route() on each API call.
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { Nav } from "@/ui/Nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <>
      <Nav email={user.email} />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
