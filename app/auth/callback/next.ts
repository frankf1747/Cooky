// Where the auth callback may send the user next: only a path on this site.

export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/onboarding";
  return next;
}
