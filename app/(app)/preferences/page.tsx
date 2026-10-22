// Owner: Plan & Shop. Preferences (LRN3): what Cooky remembers about your taste, editable here.
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import * as preferences from "@/modules/preferences";
import { Page } from "@/ui/Page";
import { PreferencesClient } from "./PreferencesClient";

export default async function PreferencesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { items } = await preferences.list(user.id);
  const titles = await preferences.recipeTitles(items.flatMap((p) => (p.scopeRecipeId ? [p.scopeRecipeId] : [])));

  return (
    <Page
      back={{ href: "/plan", label: "Plan dinners" }}
      kicker="Your taste"
      title="Preferences"
      description={<>What Bao remembers about your taste. <span className="font-medium text-foreground">Never</span> keeps a dish out of every plan; <span className="font-medium text-foreground">Prefer</span> guides the picks. Anything you write in a plan request wins for that plan.</>}
      width="narrow"
    >
      <PreferencesClient initial={items} titles={titles} />
    </Page>
  );
}
