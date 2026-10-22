// Owner: Recipes & Cook. Shown while the Cook tab loads.
import { PageSkeleton } from "@/ui/States";

export default function Loading() {
  return <PageSkeleton layout="list" label="Loading what to cook" />;
}
