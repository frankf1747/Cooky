"use client";
// Owner: Platform. The landing page's hero: the app's fridge in miniature. The doors swing open,
// plated dishes sit on the shelves, and tapping one picks it, the way the real Fridge tab works.
// Bao sits on top and hops at each pick. It is a demo: nothing is saved, and the picks go nowhere
// but the count under it. Under reduced motion the doors are simply open.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Plus } from "@phosphor-icons/react";
import { Bao } from "@/ui/Bao";
import { DishArt } from "@/ui/DishArt";

/** Dishes from the library: the top shelf can be cooked now, the bottom one is a thing short. */
const SHELVES: { label: string; dishes: { id: string; title: string; soon?: boolean }[] }[] = [
  {
    label: "Everything's here",
    dishes: [
      { id: "rcp_shakshuka", title: "Shakshuka", soon: true },
      { id: "rcp_garlic_butter_pasta", title: "Garlic butter spaghetti" },
      { id: "rcp_egg_fried_rice", title: "Egg fried rice", soon: true },
    ],
  },
  {
    label: "Missing one thing",
    dishes: [
      { id: "rcp_oyakodon", title: "Oyakodon" },
      { id: "rcp_chickpea_coconut_curry", title: "Chickpea curry" },
      { id: "rcp_honey_garlic_salmon", title: "Honey garlic salmon" },
    ],
  },
];

export function FridgeDemo() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(t);
  }, []);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="relative mx-auto w-full max-w-[25rem] overflow-x-clip px-10 pt-14 sm:px-12">
      {/* Bao on top of the fridge, hopping at every pick (the key replays the hop) */}
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <Bao key={picked.length} mood={picked.length ? "celebrating" : "welcoming"} pose={picked.length ? "cheer" : "wave"} motion={picked.length ? "hop" : "none"} size={76} />
      </div>

      <div className="relative">
        <div className="relative rounded-[30px] bg-cobalt-deep p-2.5 shadow-float">
          <div className="relative overflow-hidden rounded-[22px] bg-surface px-3 pb-3 pt-4" inert={!open}>
            <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,var(--accent-soft),transparent_70%)] transition-opacity duration-700 ${open ? "opacity-100" : "opacity-0"}`} />
            {SHELVES.map((shelf, s) => (
              <div key={shelf.label} className={s ? "mt-4" : ""}>
                <p className="relative px-1 text-[12px] font-medium text-muted">{shelf.label}</p>
                <ul className="relative mt-2.5 grid grid-cols-3 gap-2">
                  {shelf.dishes.map((d, i) => {
                    const on = picked.includes(d.id);
                    return (
                      <li key={d.id} className={open ? "rise-in" : "opacity-0"} style={{ animationDelay: `${600 + (s * 3 + i) * 70}ms` }}>
                        <button type="button" onClick={() => toggle(d.id)} aria-pressed={on} className="group flex w-full flex-col items-center text-center">
                          <span className={`relative block w-full max-w-[5.25rem] transition duration-300 ${on ? "-translate-y-1" : "group-hover:-translate-y-0.5"}`}>
                            <span className={`block aspect-square overflow-hidden rounded-full ring-offset-2 ring-offset-surface transition ${on ? "ring-[3px] ring-accent" : ""}`}>
                              <DishArt id={d.id} title={d.title} frame="plate" className="h-full w-full" />
                            </span>
                            <span className={`absolute -right-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-full shadow-float transition ${on ? "bg-accent text-on-accent" : "bg-surface text-foreground"}`}>
                              {on ? <Check size={12} weight="bold" className="tick-pop" aria-hidden /> : <Plus size={12} weight="bold" aria-hidden />}
                            </span>
                            {d.soon && <span aria-hidden className="absolute bottom-0.5 left-0.5 h-3 w-3 rounded-full border-2 border-surface bg-tomato" />}
                          </span>
                          <span className="mt-1.5 line-clamp-2 text-[11.5px] font-medium leading-tight">{d.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div aria-hidden className="mt-3 h-1.5 rounded-full border-t-2 border-line-strong/50 bg-sunken" />
              </div>
            ))}
          </div>

          {/* the doors: decoration, out of the way once open */}
          <div aria-hidden className="pointer-events-none absolute inset-0 flex [perspective:1400px]">
            {(["left", "right"] as const).map((side) => (
              <div
                key={side}
                className={`relative h-full w-1/2 bg-cobalt-deep transition-transform duration-[950ms] ease-[cubic-bezier(.3,.75,.2,1)] [backface-visibility:hidden] ${side === "left" ? "origin-left rounded-l-[30px] rounded-r-md border-r border-on-brand/15" : "origin-right rounded-l-md rounded-r-[30px] border-l border-on-brand/15 delay-[80ms]"} ${open ? (side === "left" ? "[transform:rotateY(-100deg)]" : "[transform:rotateY(100deg)]") : ""}`}
              >
                <span className={`absolute top-1/2 h-20 w-1.5 -translate-y-1/2 rounded-full bg-on-brand/75 ${side === "left" ? "right-3" : "left-3"}`} />
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden className="mx-auto flex w-[72%] justify-between">
          <span className="h-2 w-6 rounded-b-lg bg-cobalt-deep" />
          <span className="h-2 w-6 rounded-b-lg bg-cobalt-deep" />
        </div>
      </div>

      {/* what the picks would become */}
      <p aria-live="polite" className="mt-4 flex min-h-11 items-center justify-center gap-2 text-center text-sm text-muted">
        {picked.length === 0 ? (
          "Tap a dish to put it in your plan."
        ) : (
          <>
            <span className="font-medium text-foreground">{picked.length} {picked.length === 1 ? "dish" : "dishes"} picked.</span>
            <Link href="/signup" className="inline-flex items-center gap-1 font-medium text-accent underline-offset-4 hover:underline">
              Plan them <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
