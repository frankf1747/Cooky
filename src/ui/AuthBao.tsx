"use client";
// Owner: Platform. Bao on the signed-out pages: it waves, its eyes follow the pointer, it looks at
// the field you are typing in, and it covers its eyes while you type a password. Pointer moves
// are read once per frame and only this small component re-renders.
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
        setLook({ x: (e.clientX - (r.left + r.width / 2)) / 240, y: (e.clientY - (r.top + r.height / 2)) / 240 });
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
    <div ref={box} className="inline-flex flex-col items-center gap-2">
      <Bao
        mood={attention === "password" ? "happy" : "look"}
        pose={attention === "password" ? "cover" : "wave"}
        look={eyes}
        motion="bob"
        size={120}
        className="h-16 w-16 lg:h-32 lg:w-32"
      />
      <span className="rounded-full border border-zinc-200 bg-surface px-3 py-1 text-xs dark:border-zinc-800" aria-live="polite">{CAPTION[attention]}</span>
    </div>
  );
}
