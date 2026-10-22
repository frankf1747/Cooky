"use client";
// Owner: Plan & Shop. The shopping list failed to load: say so and offer a retry.
import { ErrorState } from "@/ui/States";

export default function ShopError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Couldn't load your shopping list" error={error} retry={retry} back={{ href: "/plan", label: "Back to your plans" }}>
      Something went wrong on our side. Your ticks are safe.
    </ErrorState>
  );
}
