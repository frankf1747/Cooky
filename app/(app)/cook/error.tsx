"use client";
// Owner: Recipes & Cook. Shown when the Cook tab could not load.
import { ErrorState } from "@/ui/States";

export default function CookTabError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Couldn't load what to cook" error={error} retry={retry} back={{ href: "/recipes", label: "Browse recipes" }}>
      Your plan or fridge could not be reached. Nothing has changed.
    </ErrorState>
  );
}
