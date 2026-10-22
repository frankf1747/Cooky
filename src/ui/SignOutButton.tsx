"use client";
// Owner: Platform. Sign out from Settings. Like the account menu, it clears this browser's plan
// picks first, so the next person on this device starts with an empty plan.
import { SignOut } from "@phosphor-icons/react";
import { planPicks } from "./planPicks";
import { btnSecondary } from "./styles";

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post" onSubmit={() => planPicks.clear()}>
      <button className={`w-full ${btnSecondary}`}>
        <SignOut size={18} aria-hidden />
        Sign out
      </button>
    </form>
  );
}
