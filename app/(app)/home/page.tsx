// Owner: Platform. Where a signed-in person lands: set-up first if it isn't done, otherwise the
// fridge, which is the app's front page. Sign-in, the marketing page and old links come here.
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import * as account from "@/modules/account";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const me = await account.me(user.id, user.email);
  redirect(me.onboarded ? "/fridge" : "/onboarding");
}
