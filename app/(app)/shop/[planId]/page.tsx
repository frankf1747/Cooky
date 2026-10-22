// Owner: Plan & Shop. The in-store shopping list (journey step 4, PLN9): grouped by aisle, tick as you go.
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/platform/auth";
import { ApiError } from "@/platform/errors";
import { shoppingView, type ShoppingView } from "@/modules/planning";
import { Page } from "@/ui/Page";
import { ShopList } from "./ShopList";

export default async function ShopPage(props: PageProps<"/shop/[planId]">) {
  const { planId } = await props.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let view: ShoppingView;
  try {
    view = await shoppingView(user.id, planId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const titles = Object.fromEntries(view.plan.meals.map((m) => [m.recipeId, m.title]));

  return (
    <Page
      back={{ href: `/plan/${planId}`, label: "Back to the plan" }}
      title="Shopping list"
      description={view.plan.meals.map((m) => m.title).join(" · ")}
    >
      <ShopList
        planId={planId}
        version={view.plan.version}
        aisles={view.aisles}
        initialChecked={view.checked}
        covered={view.covered}
        titles={titles}
        totalCents={view.plan.totalCents}
        priceAsOf={view.plan.priceAsOf}
      />
    </Page>
  );
}
