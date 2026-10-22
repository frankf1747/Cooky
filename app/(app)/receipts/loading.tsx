// Owner: Receipts. Shown while a receipt page loads.
import { PageSkeleton } from "@/ui/States";

export default function Loading() {
  return <PageSkeleton layout="list" label="Loading your receipt" />;
}
