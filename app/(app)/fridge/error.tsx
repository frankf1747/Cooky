'use client';
// Owner: Fridge. The fridge could not load: say so and offer a retry (never made-up items).
import { ErrorState } from '@/ui/States';

export default function FridgeError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState title="Your fridge could not load" error={error} retry={retry} back={{ href: '/recipes', label: 'Browse recipes' }}>
      The catalog or sign-in service could not be reached. Your stored food has not been changed.
    </ErrorState>
  );
}
