// Password rules shared by sign-up, change password and reset password (SPEC ACC1).

/** The shortest password Cooky accepts (Supabase allows shorter; sign-up has always asked for 8). */
export const PASSWORD_MIN_CHARS = 8;

/** What is wrong with a new password, or null. Pass `current` only when changing a known password. */
export function passwordProblem(p: { current?: string; next: string; confirm: string }): string | null {
  if (p.current !== undefined && !p.current) return "Enter your current password.";
  if (p.next.length < PASSWORD_MIN_CHARS) return `Use at least ${PASSWORD_MIN_CHARS} characters.`;
  if (p.next !== p.confirm) return "The two new passwords don't match.";
  if (p.current !== undefined && p.next === p.current) return "Choose a password different from your current one.";
  return null;
}
