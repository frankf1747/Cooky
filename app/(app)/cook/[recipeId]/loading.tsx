// Owner: Recipes & Cook. Shown while cook mode loads.
import { PageSkeleton } from "@/ui/States";

export default function Loading() {
  return <PageSkeleton layout="focus" width="narrow" label="Loading cook mode" />;
}
