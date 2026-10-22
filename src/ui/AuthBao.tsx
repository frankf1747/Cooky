"use client";
// Owner: Platform. Bao on the signed-out pages, centre stage: a big bun on a soft blob, with the
// week's groceries floating around it on the colour tiles (carrot, egg, pepper, leaf, cheese) and
// a speech bubble. It waves, its eyes follow the pointer, it looks at the field you are typing
// in, and it covers its eyes while you type a password. Pointer moves are read once per frame
// and only this small component re-renders.
import { useEffect, useRef, useState } from "react";
import { Carrot, Cheese, Egg, Leaf, Pepper, type Icon } from "@phosphor-icons/react";
import { Bao } from "./Bao";
import { tiles, type Tile } from "./styles";

export type AuthAttention = "none" | "email" | "password";

const CAPTION: Record<AuthAttention, string> = {
  none: "Hi. Bao here.",
  email: "Go on, I'm listening.",
  password: "Not looking. Promise.",
};

/** What floats around Bao: one grocery per tile colour, each bobbing on its own beat. */
const ORBIT: { icon: Icon; tile: Tile; pos: string; delay: string }[] = [
  { icon: Carrot, tile: "tangerine", pos: "-left-2 top-8 lg:-left-6 lg:top-12", delay: "0s" },
  { icon: Egg, tile: "butter", pos: "-right-1 bottom-3 lg:-right-4 lg:bottom-6", delay: "0.7s" },
  { icon: Pepper, tile: "sakura", pos: "-left-5 bottom-14 lg:-left-10 lg:bottom-24", delay: "1.3s" },
  { icon: Leaf, tile: "mint", pos: "-right-5 bottom-10 lg:-right-10 lg:bottom-16", delay: "1.9s" },
  { icon: Cheese, tile: "butter", pos: "left-9 -bottom-1 lg:left-12 lg:bottom-0", delay: "2.4s" },
];

export function AuthBao({ attention }: { attention: AuthAttention }) {
  const box = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = box.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setLook({ x: (e.clientX - (r.left + r.width / 2)) / 260, y: (e.clientY - (r.top + r.height / 2)) / 260 });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // While a field has focus, Bao looks at the form (below on phones, to the right on wide screens).
  const eyes = attention === "email" ? { x: 0.7, y: 0.8 } : look;

  return (
    <div ref={box} className="relative mx-auto w-fit p-5 lg:p-8">
      {/* the stage: a soft blob, and a shadow under the bun */}
      <div aria-hidden className="blob absolute inset-0 bg-surface/70" />
      <div aria-hidden className="absolute bottom-6 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-foreground/10 blur-sm lg:bottom-9 lg:w-36" />

      <Bao
        mood={attention === "password" ? "happy" : "look"}
        pose={attention === "password" ? "cover" : "wave"}
        look={eyes}
        motion="bob"
        size={260}
        className="relative h-44 w-44 lg:h-64 lg:w-64"
      />

      {ORBIT.map(({ icon: Icon, tile, pos, delay }) => (
        <span
          key={tile + pos}
          aria-hidden
          style={{ animationDelay: delay }}
          className={`bao-bob absolute flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface shadow-sm shadow-foreground/10 lg:h-12 lg:w-12 ${tiles[tile]} ${pos}`}
        >
          <Icon size={20} weight="duotone" className="lg:hidden" />
          <Icon size={24} weight="duotone" className="hidden lg:block" />
        </span>
      ))}

      <span
        className="absolute -right-3 top-3 rounded-2xl rounded-bl-md border border-zinc-200 bg-surface px-3 py-1.5 text-xs font-medium shadow-sm shadow-foreground/10 lg:-right-8 lg:top-10 lg:text-sm dark:border-zinc-700"
        aria-live="polite"
      >
        {CAPTION[attention]}
      </span>
    </div>
  );
}
