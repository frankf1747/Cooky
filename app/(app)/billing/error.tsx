"use client";
// Owner: Platform. The page could not load: say so and offer a retry (never made-up defaults).
import { ErrorState } from "@/ui/States";

export default function BillingError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Cooky Pro didn't load" error={error} retry={retry} back={{ href: "/fridge", label: "Back to the fridge" }}>
      Something went wrong on our side. Nothing was charged or changed.
    </ErrorState>
  );
}
