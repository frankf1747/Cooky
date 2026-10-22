// Owner: Plan & Shop. Preferences (LRN3): what Cooky remembers about your taste, editable here.
import { redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import * as preferences from "@/modules/preferences";
import { PreferencesClient } from "./PreferencesClient";

export default async function PreferencesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { items } = await preferences.list(user.id);
  const titles = await preferences.recipeTitles(items.flatMap((p) => (p.scopeRecipeId ? [p.scopeRecipeId] : [])));

  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
      <p className="mt-1 text-sm text-zinc-500">
        What Cooky remembers about your taste. <span className="font-medium text-zinc-700 dark:text-zinc-300">Never</span> rules keep a dish
        out of every plan; <span className="font-medium text-zinc-700 dark:text-zinc-300">Prefer</span> notes guide which dishes Cooky picks.
        Anything you write in a plan request wins for that plan.
      </p>
      <PreferencesClient initial={items} titles={titles} />
    </section>
  );
}
