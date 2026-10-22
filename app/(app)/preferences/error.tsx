"use client";
// Owner: Plan & Shop. Preferences failed to load: say so and offer a retry.
import { ErrorState } from "@/ui/States";

export default function PreferencesError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Couldn't load your preferences" error={error} retry={retry} back={{ href: "/plan", label: "Back to planning" }}>
      Something went wrong on our side. Nothing was changed.
    </ErrorState>
  );
}
