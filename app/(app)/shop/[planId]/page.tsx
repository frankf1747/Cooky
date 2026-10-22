// Owner: Plan & Shop. The shopping list lives on the plan page for now (PLN3); this address
// takes you there instead of showing an empty page.
import { redirect } from "next/navigation";

export default async function ShopPage(props: PageProps<"/shop/[planId]">) {
  const { planId } = await props.params;
  redirect(`/plan/${planId}#shopping`);
}
