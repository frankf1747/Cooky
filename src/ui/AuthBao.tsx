"use client";
// Owner: Platform. Bao on the signed-out pages, centre stage and nothing else: a big bun with a
// shadow and one speech bubble. It waves, its eyes follow the pointer, it looks at the field you
// are typing in, and it covers its eyes while you type a password. Pointer moves are read once
// per frame and only this small component re-renders.
import { useEffect, useRef, useState } from "react";
import { Bao } from "./Bao";

export type AuthAttention = "none" | "email" | "password";

const CAPTION: Record<AuthAttention, string> = {
  none: "Hi. Bao here.",
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
  const eyes = attention === "email" ? { x: 0.7, y: 0.8 } : look;

  return (
    <div ref={box} className="relative mx-auto w-fit">
      <div aria-hidden className="absolute bottom-1 left-1/2 h-4 w-28 -translate-x-1/2 rounded-full bg-foreground/15 blur-md lg:bottom-2 lg:w-44" />
      <Bao
        mood={attention === "password" ? "happy" : "look"}
        pose={attention === "password" ? "cover" : "wave"}
        look={eyes}
        motion="bob"
        detail="rich"
        size={320}
        className="relative h-52 w-52 lg:h-80 lg:w-80"
      />
      <span
        className="absolute -right-4 top-6 rounded-2xl rounded-bl-md bg-surface px-3.5 py-2 text-sm font-medium shadow-sm shadow-foreground/10 lg:-right-10 lg:top-14 lg:text-base"
        aria-live="polite"
      >
        {CAPTION[attention]}
      </span>
    </div>
  );
}
