// Owner: Platform. Shown while the page loads.
import { PageSkeleton } from "@/ui/States";

export default function Loading() {
  return <PageSkeleton layout="form" width="narrow" label="Loading" />;
}
