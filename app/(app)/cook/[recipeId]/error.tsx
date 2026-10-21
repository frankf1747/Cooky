"use client";
// Owner: Recipes & Cook. Shown when cook mode could not load.
import Link from "next/link";
import { maru } from "../../recipes/font";
import { FunStyles, ui } from "../../recipes/fun";
import { Mascot } from "../../recipes/Mascot";

export default function CookError({ reset }: { reset: () => void }) {
  return (
    <div className={`${ui.page} ${maru.className}`}>
      <FunStyles />
      <section className={`mx-auto mt-6 flex w-full max-w-xl items-start gap-4 bg-white p-6 shadow-[4px_4px_0_0_#FFB7C5] ${ui.frame} ${ui.wobble}`}>
        <Mascot mood="worried" size={72} className="shrink-0" />
        <div>
          <h1 className={`text-xl ${ui.heading}`}>Cook mode could not load</h1>
          <p role="alert" className={`mt-1 text-sm ${ui.muted}`}>The recipe could not be reached. Your fridge has not been changed.</p>
          <div className="mt-4 flex gap-3">
            <button className={`px-4 py-2 text-sm ${ui.btn} ${ui.wobbleSm}`} onClick={reset}>Try again</button>
            <Link className={`px-4 py-2 text-sm ${ui.btnGhost} ${ui.wobbleSm}`} href="/recipes">Back to recipes</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
