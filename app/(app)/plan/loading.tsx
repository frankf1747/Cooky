// Owner: Plan & Shop. Shown while a plan page loads.
import { PageSkeleton } from "@/ui/States";

export default function Loading() {
  return <PageSkeleton layout="form" width="narrow" label="Loading your plans" />;
}
