// Owner: Recipes & Cook. Add a recipe (RCP5 text import, RCP6): a Cooky Pro feature. Describe a
// dish or paste a recipe; Bao writes a draft to check before it joins the library. Import from a
// link or a photo (RCP4, RCP5 image) is still v2.
import Link from "next/link";
import { redirect } from "next/navigation";
import targets from "@spec/targets.json";
import { getSessionUser, isPro } from "@/platform/auth";
import * as recipes from "@/modules/recipes";
import { EmptyState, Page } from "@/ui/Page";
import { btnPrimary, btnSecondary } from "@/ui/styles";
import { AddRecipe } from "./AddRecipe";

export default async function AddRecipePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const pro = await isPro(user.id);
  const catalog = pro
    ? (await recipes.listIngredients(user.id, undefined)).items.map((i) => ({ id: i.id, name: i.name, aliases: i.aliases, category: i.category, baseUnit: i.baseUnit }))
    : [];

  return (
    <Page
      back={{ href: "/recipes", label: "All recipes" }}
      kicker="Cooky Pro"
      tone="shop"
      title="Add a recipe"
      description="Tell Bao what you feel like eating. It writes the recipe; you check it and add it to your library."
      width="narrow"
    >
      {pro ? (
        <AddRecipe catalog={catalog} maxChars={targets.limits.importTextMaxChars} />
      ) : (
        <EmptyState
          title="Bao writes recipes with Pro"
          mood="encouraging"
          pose="hold"
          prop="spoon"
          action={<><Link href="/billing" className={btnPrimary}>Unlock Pro</Link><Link href="/recipes" className={btnSecondary}>Browse recipes</Link></>}
        >
          Describe a dish, like &ldquo;a cozy soup with white beans&rdquo;, and Bao writes a recipe in Cooky&apos;s ingredients, ready to plan and cook.
        </EmptyState>
      )}
    </Page>
  );
}
