"use client";
// Owner: Recipes & Cook. Shown when the library or a recipe could not load.
import { maru } from "./font";
import { Mascot } from "./Mascot";
import { ui } from "./fun";

export default function RecipesError({ reset }: { reset: () => void }) {
  return (
    <div className={`${ui.page} ${maru.className}`}>
      <section className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <Mascot mood="worried" size={72} />
        <h1 className={`text-2xl ${ui.heading}`}>Oops, the recipes didn&apos;t load</h1>
        <p role="alert" className={`text-sm ${ui.muted}`}>The recipe library could not be reached. Nothing in your fridge or plans has changed.</p>
        <button className={`px-4 py-2 text-sm ${ui.btn} ${ui.wobbleSm}`} onClick={reset}>Try again</button>
      </section>
    </div>
  );
}
