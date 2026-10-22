// Owner: Recipes & Cook. Shown while the library or a recipe loads.
import { PageSkeleton } from "@/ui/States";

export default function Loading() {
  return <PageSkeleton layout="grid" width="wide" label="Loading recipes" />;
}
