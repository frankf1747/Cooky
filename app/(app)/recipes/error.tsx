"use client";
// Owner: Recipes & Cook. Shown when the library or a recipe could not load.
import { ErrorState } from "@/ui/States";

export default function RecipesError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="The recipes didn't load" error={error} retry={retry} back={{ href: "/fridge", label: "Back to the fridge" }}>
      The recipe library could not be reached. Nothing in your fridge or plans has changed.
    </ErrorState>
  );
}
