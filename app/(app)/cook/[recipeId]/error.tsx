"use client";
// Owner: Recipes & Cook. Shown when cook mode could not load.
import { ErrorState } from "@/ui/States";

export default function CookError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Cook mode could not load" error={error} retry={retry} back={{ href: "/recipes", label: "Back to recipes" }}>
      The recipe could not be reached. Your fridge has not been changed.
    </ErrorState>
  );
}
