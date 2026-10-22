// Owner: Platform. The living brand sheet: Bao's construction and states, the colours and what
// each one means, type, shapes, components and the dish illustrations, rendered from the real
// components so it cannot drift from the app. Linked from the landing page footer.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bao, BaoSays, type BaoMood, type BaoPose, type BaoProp } from "@/ui/Bao";
import { Wordmark } from "@/ui/AppNav";
import { DishArt } from "@/ui/DishArt";
import { Kicker } from "@/ui/Page";
import { alert, btnPrimary, btnSecondary, btnSecondarySm, btnText, chip, chipOff, chipOn, field, h1, h2, h3, notice, panel, tag, tagGood, tagNeutral, tagPast, tagPro, tones } from "@/ui/styles";

export const metadata: Metadata = { title: "Brand" };

const MOODS: { mood: BaoMood; when: string }[] = [
  { mood: "welcoming", when: "Hello, sign-in, a fresh start" },
  { mood: "curious", when: "Watching, listening, a new screen" },
  { mood: "thinking", when: "Waiting on a plan or a receipt" },
  { mood: "encouraging", when: "Food to use soon; you can do this" },
  { mood: "confused", when: "Errors, nothing found" },
  { mood: "celebrating", when: "A meal cooked, a cart full" },
  { mood: "reassuring", when: "Before you confirm; nothing changed" },
  { mood: "resting", when: "Nothing urgent; all is well" },
];

const POSES: { pose: BaoPose; prop?: BaoProp; mood: BaoMood; label: string }[] = [
  { pose: "wave", mood: "welcoming", label: "Wave" },
  { pose: "cheer", mood: "celebrating", label: "Cheer" },
  { pose: "think", mood: "thinking", label: "Think" },
  { pose: "hold", prop: "spoon", mood: "encouraging", label: "Hold: spoon (cook)" },
  { pose: "hold", prop: "basket", mood: "welcoming", label: "Hold: basket (shop)" },
  { pose: "hold", prop: "receipt", mood: "curious", label: "Hold: receipt (scan)" },
  { pose: "hold", prop: "timer", mood: "celebrating", label: "Hold: timer" },
  { pose: "cover", mood: "reassuring", label: "Cover (password)" },
];

const COLOURS: { name: string; token: string; means: string }[] = [
  { name: "Paper", token: "--background", means: "Every page" },
  { name: "Ink", token: "--foreground", means: "Text, the active tab" },
  { name: "Cobalt", token: "--accent", means: "Actions, and only actions" },
  { name: "Cobalt tint", token: "--cobalt-tint", means: "Plan" },
  { name: "Crust", token: "--crust-tint", means: "Shop, Cooky Pro" },
  { name: "Parchment", token: "--parchment", means: "Scan, the table under food" },
  { name: "Basil", token: "--basil-tint", means: "Cook, done, good" },
  { name: "Tomato", token: "--tomato-tint", means: "Use soon" },
  { name: "Amber", token: "--past", means: "Past its date, nothing else" },
];

const DISHES = [
  ["rcp_garlic_butter_pasta", "Garlic butter spaghetti with peas"],
  ["rcp_shakshuka", "Shakshuka eggs in tomato sauce"],
  ["rcp_oyakodon", "Oyakodon chicken and egg rice bowl"],
  ["rcp_honey_garlic_salmon", "Honey garlic salmon with green beans"],
  ["rcp_beef_tacos", "Smoky beef tacos"],
  ["rcp_chickpea_coconut_curry", "Chickpea coconut curry with kale"],
  ["rcp_spinach_frittata", "Spinach frittata"],
  ["rcp_sesame_soy_noodles", "Sesame soy noodles with vegetables"],
] as const;

function Block({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <h2 className={h2}>{title}</h2>
          {note && <p className="mt-2 text-[15px] leading-relaxed text-muted">{note}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export default function BrandPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="Cooky, home" className="rounded-full"><Wordmark /></Link>
        <Link href="/login" className={btnText}>Log in</Link>
      </header>

      <div className="grid items-center gap-10 py-12 sm:py-20 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <Kicker tone="shop">The Cooky brand</Kicker>
          <h1 className={`${h1} mt-3 sm:!text-6xl`}>A bun in a chef&apos;s hat, and the rules it lives by.</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Bao is the warmth; food is the reason; the interface stays quiet so both can be seen. Everything here is drawn by the components the app uses.
          </p>
        </div>
        <div className="flex justify-center">
          <Bao mood="welcoming" pose="wave" motion="breathe" size={300} className="h-56 w-56 sm:h-72 sm:w-72" />
        </div>
      </div>

      <Block title="Construction" note="A toasted dome with a flat base, a toque that leans six degrees left, a cobalt band. Two flat tones, no outline. The face sits low; expression lives in the eyes, brows and a body tilt.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <figure className={`${panel} flex flex-col items-center p-4`}>
            <Bao size={140} decorative />
            <figcaption className="mt-2 text-sm text-muted">Full colour</figcaption>
          </figure>
          <figure className={`${panel} flex flex-col items-center p-4`}>
            <Bao size={140} decorative className="brightness-0 dark:invert" />
            <figcaption className="mt-2 text-sm text-muted">Silhouette test</figcaption>
          </figure>
          <figure className={`${panel} flex flex-col items-center justify-center p-4`}>
            <div className="flex items-end gap-3">
              <Bao size={24} ground={false} decorative />
              <Bao size={36} ground={false} decorative />
              <Bao size={56} ground={false} decorative />
            </div>
            <figcaption className="mt-3 text-sm text-muted">Holds at 24px</figcaption>
          </figure>
          <figure className="flex flex-col items-center justify-center rounded-2xl bg-cobalt-deep p-4 text-on-brand">
            <Wordmark />
            <figcaption className="mt-3 text-sm text-on-brand/70">The mark on cobalt</figcaption>
          </figure>
        </div>
      </Block>

      <Block title="Eight states" note="One state per moment, chosen by what the person just did. Never more than one Bao in view.">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
          {MOODS.map((m) => (
            <li key={m.mood} className="flex flex-col items-center text-center">
              <Bao mood={m.mood} size={120} />
              <p className="mt-2 font-display text-lg font-semibold capitalize">{m.mood}</p>
              <p className="mt-0.5 text-sm text-muted">{m.when}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Poses and props" note="Arms appear only when a pose needs them. Props say which step Bao is helping with.">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
          {POSES.map((p) => (
            <li key={p.label} className="flex flex-col items-center text-center">
              <Bao mood={p.mood} pose={p.pose} prop={p.prop} size={120} />
              <p className="mt-2 text-sm text-muted">{p.label}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Voice" note="One line, specific to what just happened. Warm, a little dry, never cute for its own sake, never two exclamation marks.">
        <div className="grid gap-6 sm:grid-cols-2">
          <BaoSays mood="thinking" pose="think">Weighing 20 dinners against your fridge and $40. A few seconds.</BaoSays>
          <BaoSays mood="celebrating" pose="cheer">Lemon garlic chicken, done. The fridge knows. Nice cooking.</BaoSays>
          <BaoSays mood="encouraging" pose="hold" prop="spoon">The spinach has about 2 days left. Let&apos;s put it to work first.</BaoSays>
          <BaoSays mood="confused">Nothing by that name. I checked twice.</BaoSays>
        </div>
      </Block>

      <Block title="Colour" note="Paper and ink carry the page. Cobalt is the only action colour. Each food colour means one step of the week and appears as a quiet tint or a small dot.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOURS.map((c) => (
            <li key={c.name} className={`${panel} overflow-hidden`}>
              <div className="h-16 border-b border-line" style={{ background: `var(${c.token})` }} />
              <div className="px-3.5 py-3">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted">{c.means}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(tones) as (keyof typeof tones)[]).map((t) => (
            <span key={t} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${tones[t].tint} ${tones[t].ink}`}>
              <span className={`h-2 w-2 rounded-full ${tones[t].dot}`} />
              {tones[t].label}
            </span>
          ))}
        </div>
      </Block>

      <Block title="Type" note="Fraunces at full softness for headlines and big numbers; Geist for everything you read or tap. Sentence case everywhere.">
        <div className="space-y-5">
          <p className={`${h1} sm:!text-6xl`}>Cook what you have.</p>
          <p className={h1}>Page title, 44px</p>
          <p className={h2}>Section title, 24px</p>
          <p className={h3}>Card title, 18px</p>
          <p className="max-w-xl text-base leading-relaxed">Body, Geist 16px. Bring a pan of salted water to the boil, then add the spaghetti and stir once so it doesn&apos;t stick.</p>
          <p className="text-sm text-muted">Secondary, 14px · 25 min · about $3.10 a serving</p>
        </div>
      </Block>

      <Block title="Shape" note="Pill controls, 16px cards, 24px feature panels. Food sits in the dome, the top of a bun. The dough blob sits behind illustrations; the zigzag is only for receipts.">
        <div className="grid grid-cols-3 gap-4">
          <div className="shape-dome aspect-[4/3] bg-crust-tint" />
          <div className="shape-dough aspect-[4/3] bg-basil-tint" />
          <div className="receipt-edge aspect-[4/3] rounded-t-2xl bg-parchment" />
        </div>
      </Block>

      <Block title="Components" note="One primary action per screen. Chips filter, tags label, alerts say what went wrong and what did not change.">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button className={btnPrimary}>Start cooking</button>
            <button className={btnSecondary}>Add to a plan</button>
            <button className={btnSecondarySm}>Used</button>
            <button className={btnText}>Clear the filters</button>
            <button className={btnPrimary} disabled>Planning…</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`${chip} ${chipOn}`}>Uses your fridge</span>
            <span className={`${chip} ${chipOff}`}>20 min or less</span>
            <span className={`${chip} ${chipOff}`}>Vegetarian</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={tag}>Use within 2 days</span>
            <span className={tagPast}>Past its typical date</span>
            <span className={tagGood}>Saved</span>
            <span className={tagNeutral}>Draft</span>
            <span className={tagPro}>Cooky Pro</span>
          </div>
          <input className={`${field} max-w-sm`} placeholder="Search dishes, ingredients, cuisines" />
          <p className={`${alert} max-w-lg`}>That tick didn&apos;t save. Check your connection and tap it again.</p>
          <p className={`${notice} max-w-lg`}>Food added to your fridge.</p>
        </div>
      </Block>

      <Block title="Dish illustrations" note="Until dish photography is chosen, each recipe is a top-down still life drawn from its title: a blue-rimmed plate, a bowl or a skillet on parchment.">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          {DISHES.map(([id, title]) => (
            <li key={id}>
              <DishArt id={id} title={title} className="shape-dome aspect-[4/3] w-full" />
              <p className="mt-2 text-sm font-medium">{title}</p>
            </li>
          ))}
        </ul>
      </Block>
    </main>
  );
}
