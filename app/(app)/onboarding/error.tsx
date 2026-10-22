"use client";
// Owner: Platform. The page could not load: say so and offer a retry (never made-up defaults).
import { ErrorState } from "@/ui/States";

export default function ProfileError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Setup didn't load" error={error} retry={retry} back={{ href: "/fridge", label: "Back to the fridge" }}>
      Something went wrong on our side. Nothing was changed.
    </ErrorState>
  );
}
