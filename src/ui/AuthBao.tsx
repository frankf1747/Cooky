"use client";
// Owner: Platform. Bao on the signed-out pages, centre stage and nothing else: a big bun and one
// speech bubble. It waves, its eyes follow the pointer, it looks at the field you are typing in,
// and it covers its eyes while you type a password. Pointer moves are read once per frame and
// only this small component re-renders.
import { useEffect, useRef, useState } from "react";
import { Bao } from "./Bao";

export type AuthAttention = "none" | "email" | "password";

const CAPTION: Record<AuthAttention, string> = {
  none: "Hi. I'm Bao.",
  email: "Go on, I'm listening.",
  password: "Not looking. Promise.",
};

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
  const eyes = attention === "email" ? { x: 0.8, y: 0.7 } : look;

  return (
    <div ref={box} className="relative mx-auto w-fit">
      <Bao
        key={attention === "password" ? "cover" : "open"}
        mood={attention === "password" ? "reassuring" : "curious"}
        pose={attention === "password" ? "cover" : "wave"}
        look={eyes}
        motion={attention === "password" ? "nod" : "breathe"}
        size={320}
        className="relative h-44 w-44 lg:h-80 lg:w-80"
      />
      <span
        className="absolute left-[78%] top-[38%] whitespace-nowrap rounded-[18px] rounded-bl-md bg-paper px-3.5 py-2 text-sm font-medium text-on-paper shadow-float lg:left-[80%] lg:top-[34%] lg:text-base"
        aria-live="polite"
      >
        {CAPTION[attention]}
      </span>
    </div>
  );
}
