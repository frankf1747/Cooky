// Owner: Plan & Shop. Shown while the shopping list loads.
import { PageSkeleton } from "@/ui/States";

export default function Loading() {
  return <PageSkeleton layout="list" label="Loading the shopping list" />;
}
