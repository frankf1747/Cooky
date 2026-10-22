"use client";
// Owner: Fridge. The landing: a fridge whose doors swing open when you arrive. Inside, plated
// dishes you can cook from what is in it today (top shelf: everything is here; next shelf:
// missing one or two things), and the crisper drawer with what you have, use-soon first. Tap a
// plate to put it in your plan (src/ui/planPicks); the count follows you to the Plan tab.
// The doors are decoration: everything inside is a real button or text that works without
// them, and under reduced motion the fridge is simply open. The person can close it again (the
// button under it, or a tap on the closed doors opens it), and while it is shut the shelves are
// inert, so nothing behind the doors takes focus.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Door as DoorIcon, DoorOpen, Plus } from "@phosphor-icons/react";
import type { CookNowEntry, FridgeItem } from "@spec/contract";
import { Bao } from "@/ui/Bao";
import { DishArt } from "@/ui/DishArt";
import { PICKS_MAX, planPicks, usePlanPicks } from "@/ui/planPicks";
import { btnPrimary, btnSecondary, btnSecondarySm, btnText, tag, tagNeutral, tagPast } from "@/ui/styles";

/** How many plates fit on each shelf. */
const READY_MAX = 6;
const NEARLY_MAX = 3;
const CRISPER_MAX = 8;

type Props = {
  cookNow: CookNowEntry[];
  items: FridgeItem[];
  expiringSoon: string[];
  today: string;
  onAddByHand: () => void;
};

export function VirtualFridge({ cookNow, items, expiringSoon, today, onAddByHand }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 350);
    return () => clearTimeout(t);
  }, []);
  const picks = usePlanPicks();

  const ready = cookNow.filter((c) => c.coverage >= 1).slice(0, READY_MAX);
  const nearly = cookNow.filter((c) => c.coverage > 0 && c.coverage < 1 && c.missingIngredientIds.length <= 2).slice(0, NEARLY_MAX);
  const empty = items.length === 0;
  const soon = new Set(expiringSoon);
  const pastDate = (i: FridgeItem) => Boolean(i.expiresOn && i.expiresOn < today);
  const crisper = [...items].sort((a, b) => Number(soon.has(b.id)) - Number(soon.has(a.id))).slice(0, CRISPER_MAX);

  return (
    <div className="-mx-4 overflow-x-clip px-12 pb-3 pt-1 sm:mx-0 sm:px-16">
      <div className="relative mx-auto w-full max-w-[34rem]">
        {/* the cabinet */}
        <div className="relative rounded-[34px] bg-cobalt-deep p-2.5 shadow-float sm:p-3">
          <div className="relative overflow-hidden rounded-[26px] bg-surface">
            {/* the fridge light comes on as the doors open */}
            <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,var(--accent-soft),transparent_70%)] transition-opacity duration-700 ${open ? "opacity-100" : "opacity-0"}`} />

            <div className="relative px-3 pb-3 pt-5 sm:px-5 sm:pt-6" inert={!open}>
              {empty ? (
                <div className="flex flex-col items-center px-2 pb-4 pt-2 text-center">
                  <Bao mood="welcoming" pose="wave" motion={open ? "nod" : "none"} size={128} />
                  <Glass className="w-3/4" />
                  <p className="mt-5 font-display text-xl font-semibold">It&apos;s just me in here.</p>
                  <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted">Stock the fridge and the dishes you can cook show up on these shelves.</p>
                  <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Link href="/receipts/new" className={btnPrimary}>Stock up from a receipt</Link>
                    <button type="button" onClick={onAddByHand} className={btnSecondary}>Add food by hand</button>
                  </div>
                </div>
              ) : (
                <>
                  {ready.length > 0 && <Shelf label="Everything's here" dishes={ready} picks={picks} open={open} start={0} legend />}
                  {nearly.length > 0 && <Shelf label="Missing one or two things" dishes={nearly} picks={picks} open={open} start={ready.length} legend={ready.length === 0} />}
                  {ready.length === 0 && nearly.length === 0 && (
                    <div className="px-2 py-6 text-center">
                      <p className="font-display text-xl font-semibold">Nothing cookable yet</p>
                      <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted">A few more ingredients and dinners appear here. Or pick one from the library.</p>
                      <Link href="/recipes" className={`mt-4 ${btnSecondary}`}>Browse recipes</Link>
                    </div>
                  )}

                  {/* the crisper drawer: what you have, use-soon first */}
                  <div className="mt-4 rounded-2xl border-t-2 border-line-strong/50 bg-sunken/80 px-3 pb-3 pt-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13px] font-medium text-muted">In the crisper</p>
                      <a href="#inside" className={`text-[13px] ${btnText}`}>All {items.length}</a>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {crisper.map((i) => (
                        <li key={i.id} className={pastDate(i) ? tagPast : soon.has(i.id) ? tag : tagNeutral}>{i.name}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* the doors: decoration, so hidden from assistive tech; out of the way while open, and a
              tap on them while shut opens them (the button below does the same for everyone) */}
          <div aria-hidden onClick={() => setOpen(true)} className={`absolute inset-0 flex [perspective:1800px] ${open ? "pointer-events-none" : "cursor-pointer"}`}>
            <Door side="left" open={open}>
              <span className="absolute left-5 top-6 font-display text-sm font-semibold text-on-brand/70">cooky</span>
              <Bao mood="welcoming" size={58} ground={false} decorative className="absolute left-1/2 top-[28%] -translate-x-1/2 -rotate-6" />
            </Door>
            <Door side="right" open={open}>
              <span className="absolute left-1/2 top-[30%] w-[64%] -translate-x-1/2 rotate-3 rounded-md bg-paper px-3 py-3 text-center font-display text-[15px] italic leading-snug text-on-paper shadow-float">
                {empty ? "Empty. Stock me." : ready.length ? `${ready.length} ${ready.length === 1 ? "dinner" : "dinners"} ready` : "What's for dinner?"}
              </span>
            </Door>
          </div>
        </div>
        {/* feet */}
        <div aria-hidden className="mx-auto flex w-[72%] justify-between">
          <span className="h-2.5 w-7 rounded-b-lg bg-cobalt-deep" />
          <span className="h-2.5 w-7 rounded-b-lg bg-cobalt-deep" />
        </div>
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={() => setOpen((o) => !o)} className={btnSecondarySm}>
            {open ? <DoorIcon size={18} aria-hidden /> : <DoorOpen size={18} aria-hidden />}
            {open ? "Close the fridge" : "Open the fridge"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A glass shelf under a row of plates. */
function Glass({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`h-2 rounded-full border-t-2 border-line-strong/50 bg-sunken ${className}`} />;
}

function Shelf({ label, dishes, picks, open, start, legend = false }: { label: string; dishes: CookNowEntry[]; picks: { id: string }[]; open: boolean; start: number; legend?: boolean }) {
  const full = picks.length >= PICKS_MAX;
  // The dot's meaning is said once, on the top shelf.
  const anySoon = legend && dishes.some((d) => d.usesExpiringItemIds.length > 0);
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {anySoon && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <span aria-hidden className="h-2 w-2 rounded-full bg-tomato" />
            uses food to use soon
          </p>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-5 sm:gap-x-4">
        {dishes.map((d, i) => {
          const on = picks.some((p) => p.id === d.recipeId);
          return (
            <li key={d.recipeId} className={open ? "rise-in" : "opacity-0"} style={{ animationDelay: `${450 + (start + i) * 70}ms` }}>
              <button
                type="button"
                onClick={() => planPicks.toggle({ id: d.recipeId, title: d.title })}
                disabled={!on && full}
                aria-pressed={on}
                className="group flex w-full flex-col items-center text-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={`relative block w-full max-w-[6.5rem] transition duration-300 ${on ? "-translate-y-1" : "group-hover:-translate-y-0.5"}`}>
                  <span className={`block aspect-square overflow-hidden rounded-full ring-offset-2 ring-offset-surface transition ${on ? "ring-[3px] ring-accent" : ""}`}>
                    <DishArt id={d.recipeId} title={d.title} frame="plate" className="h-full w-full" />
                  </span>
                  <span className={`absolute -right-0.5 -top-0.5 flex h-7 w-7 items-center justify-center rounded-full shadow-float transition ${on ? "bg-accent text-on-accent" : "bg-surface text-foreground"}`}>
                    {on ? <Check size={14} weight="bold" className="tick-pop" aria-hidden /> : <Plus size={14} weight="bold" aria-hidden />}
                  </span>
                  {d.usesExpiringItemIds.length > 0 && <span aria-hidden className="absolute bottom-1 left-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-tomato" />}
                </span>
                <span className="mt-2.5 line-clamp-2 text-[12.5px] font-medium leading-tight sm:text-[13px]">{d.title}</span>
                {d.missingIngredientIds.length > 0 && <span className="mt-0.5 text-[11px] text-muted">Missing {d.missingIngredientIds.length}</span>}
                <span className="sr-only">{d.usesExpiringItemIds.length > 0 && ", uses food to use soon"}{on ? ", in your plan. Tap to take it out." : full ? ", your plan is full." : ", tap to add to your plan."}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Glass className="mt-4" />
    </div>
  );
}

function Door({ side, open, children }: { side: "left" | "right"; open: boolean; children: React.ReactNode }) {
  const left = side === "left";
  return (
    <div
      className={`relative h-full w-1/2 transition-transform duration-[950ms] ease-[cubic-bezier(.3,.75,.2,1)] [transform-style:preserve-3d] ${left ? "origin-left" : "origin-right delay-[80ms]"} ${open ? (left ? "[transform:rotateY(-100deg)]" : "[transform:rotateY(100deg)]") : ""}`}
    >
      {/* front */}
      <div className={`absolute inset-0 bg-cobalt-deep [backface-visibility:hidden] ${left ? "rounded-l-[34px] rounded-r-md border-r border-on-brand/15" : "rounded-l-md rounded-r-[34px] border-l border-on-brand/15"}`}>
        <span className={`absolute top-1/2 h-28 w-2 -translate-y-1/2 rounded-full bg-on-brand/75 ${left ? "right-3.5" : "left-3.5"}`} />
        {children}
      </div>
      {/* the inside of the door, seen once it swings open */}
      <div className={`absolute inset-0 bg-cobalt-tint [backface-visibility:hidden] [transform:rotateY(180deg)] ${left ? "rounded-r-[34px] rounded-l-md" : "rounded-l-[34px] rounded-r-md"}`}>
        {[22, 46, 70].map((top) => (
          <span key={top} className="absolute inset-x-[12%] h-2 rounded-full bg-cobalt/25" style={{ top: `${top}%` }} />
        ))}
      </div>
    </div>
  );
}
