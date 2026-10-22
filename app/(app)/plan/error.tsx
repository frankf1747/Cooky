"use client";
// Owner: Plan & Shop. A plan page failed to load: say so and offer a retry (never a made-up plan).
import { ErrorState } from "@/ui/States";

export default function PlanError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Couldn't load your plans" error={error} retry={retry} back={{ href: "/fridge", label: "Back to the fridge" }}>
      Something went wrong on our side. Nothing was changed.
    </ErrorState>
  );
}
