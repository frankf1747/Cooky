"use client";
// Owner: Receipts. A receipt page failed to load: say so and offer a retry (never made-up lines).
import { ErrorState } from "@/ui/States";

export default function ReceiptsError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Couldn't load this receipt" error={error} retry={retry} back={{ href: "/fridge", label: "Open the fridge" }}>
      Something went wrong on our side. Nothing in your fridge changed.
    </ErrorState>
  );
}
