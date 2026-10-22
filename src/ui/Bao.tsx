"use client";
// Owner: Platform. Bao, Cooky's chef bun and the voice of the app (docs/BRAND.md).
//
// Construction, on a 120-unit square:
//   body   a toasted bun: a dome with a soft flat base, x 14–106, y 40–104. Flat two-tone
//          shading: the crust colour shows as a crescent on the right and underneath, because
//          the lit dough is the same silhouette nudged up and left. Three sesame seeds on the
//          left shoulder. No outline, no gradient, no blush.
//   hat    a toque that leans 6° to the left: a soft, lopsided puff on a pleated column with a
//          cobalt band. It sits on the bun, not in it, and lags a beat when Bao moves.
//   face   low on the dome: eyes at y 79, 24 apart; mouth at y 89. Eyes are solid ink ovals or
//          single strokes. Expression comes from eyes, brows and mouth, plus a body tilt.
//   hands  only when a pose needs them: small crust-coloured mittens, no arms.
// Eight states (welcoming, curious, thinking, encouraging, confused, celebrating, reassuring,
// resting), six poses, four props. Motion is a CSS class (globals.css) and always stops under
// reduced motion. Character colours are fixed, so Bao looks the same in both schemes.
//
// Bao is alive wherever it appears: it sways a little when it has nothing else to do, blinks,
// follows the pointer with its eyes (or glances around when nobody is pointing), and a tap
// makes it hop and beam. All of that is decoration: it never blocks an action or hides text.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type BaoMood = "welcoming" | "curious" | "thinking" | "encouraging" | "confused" | "celebrating" | "reassuring" | "resting";
export type BaoPose = "rest" | "wave" | "cheer" | "hold" | "think" | "cover";
export type BaoProp = "none" | "spoon" | "basket" | "receipt" | "timer";
export type BaoMotion = "none" | "breathe" | "hop" | "nod";

/** How long a tap reaction lasts, in ms (the hop animation is 0.9s). */
const REACT_MS = 950;
/** Bao looks around on its own after this long without the pointer moving. */
const IDLE_MS = 4000;

/**
 * Where Bao's eyes point, each axis -1..1: towards the pointer while it moves, now and then a
 * glance somewhere else when it doesn't. Only while Bao is on screen; nothing under reduced motion.
 */
function useGaze(ref: React.RefObject<SVGSVGElement | null>, enabled: boolean) {
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      lastMove = Date.now();
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = ref.current?.getBoundingClientRect();
        if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        setGaze({ x: clamp((e.clientX - (r.left + r.width / 2)) / 260), y: clamp((e.clientY - (r.top + r.height / 2)) / 260) });
      });
    };
    // Every few seconds without the pointer, a glance to one side and back.
    const glance = window.setInterval(() => {
      if (Date.now() - lastMove < IDLE_MS || document.hidden) return;
      setGaze({ x: Math.random() * 1.6 - 0.8, y: Math.random() * 0.8 - 0.3 });
      window.setTimeout(() => {
        if (Date.now() - lastMove >= IDLE_MS) setGaze({ x: 0, y: 0 });
      }, 1300);
    }, 5200 + Math.round(Math.random() * 2400));
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearInterval(glance);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);
  return gaze;
}

const LABEL: Record<BaoMood, string> = {
  welcoming: "Bao, waving hello",
  curious: "Bao, curious",
  thinking: "Bao, thinking",
  encouraging: "Bao, encouraging",
  confused: "Bao, puzzled",
  celebrating: "Bao, celebrating",
  reassuring: "Bao, reassuring",
  resting: "Bao, resting",
};

/** Fixed character colours (not theme tokens: Bao is the same bun at night). */
export const BAO = {
  dough: "#f2bc62",
  crust: "#d9913a",
  seed: "#fff4dc",
  hat: "#ffffff",
  hatShade: "#e5dccd",
  band: "#2b4bd8",
  ink: "#2b1d14",
  mouth: "#c2452a",
};

const BODY = "M27 104.5 C17.5 104.5 12 99.5 12 90.5 C12.5 61.5 32.5 40 60 40 C88 40.5 107.5 62 108 90.5 C108 99.5 102.5 104.5 93 104.5 Z";
/** Body tilt per mood, in degrees around the base. */
const TILT: Partial<Record<BaoMood, number>> = { curious: -3, thinking: -2, confused: 5, reassuring: 3 };
const OPEN_EYES: BaoMood[] = ["welcoming", "curious", "thinking", "confused"];

export function Bao({
  mood = "welcoming",
  pose = "rest",
  prop = "none",
  motion = "none",
  look,
  ground = true,
  size = 40,
  className = "",
  decorative = false,
}: {
  mood?: BaoMood;
  pose?: BaoPose;
  prop?: BaoProp;
  motion?: BaoMotion;
  /** Where the eyes look, each axis -1..1 (open-eyed moods only). */
  look?: { x: number; y: number };
  /** The soft shadow under the bun. Off for the logo mark. */
  ground?: boolean;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  // A tap: Bao hops and beams for a moment. `tap` remounts the svg so the hop replays every tap.
  const [tap, setTap] = useState(0);
  const [beaming, setBeaming] = useState(false);
  useEffect(() => {
    if (!beaming) return;
    const t = window.setTimeout(() => setBeaming(false), REACT_MS);
    return () => window.clearTimeout(t);
  }, [tap, beaming]);
  const shown: BaoMood = beaming ? "celebrating" : mood;
  // Eyes follow the pointer unless the page says where to look (or the eyes are shut).
  const gaze = useGaze(svg, !look && OPEN_EYES.includes(mood) && size >= 28);
  const eye = look ?? gaze;
  const lx = Math.max(-1, Math.min(1, eye.x)) * 3;
  const ly = Math.max(-1, Math.min(1, eye.y)) * 2.5;
  const covered = pose === "cover";
  const blink = OPEN_EYES.includes(shown) && size >= 28 && !covered;
  const tilt = TILT[shown] ?? 0;
  const stroke = { stroke: BAO.ink, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  const oval = (cx: number, cy: number, rx = 3.6, ry = 4.7) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={BAO.ink} />;
  const eyes: Record<BaoMood, ReactNode> = {
    welcoming: <>{oval(48 + lx, 79 + ly)}{oval(72 + lx, 79 + ly)}</>,
    curious: <>{oval(48 + lx, 78.5 + ly, 3.9, 5.2)}{oval(72 + lx, 78.5 + ly, 3.9, 5.2)}</>,
    thinking: <>{oval(49.5, 77)}{oval(73.5, 77)}</>,
    confused: <>{oval(48, 79)}{oval(72, 79.5, 2.8, 3.5)}</>,
    encouraging: <g {...stroke}><path d="M44 80.5 q4 -5.5 8 0" /><path d="M68 80.5 q4 -5.5 8 0" /></g>,
    celebrating: <g {...stroke}><path d="M43.5 81 q4.5 -6.5 9 0" /><path d="M67.5 81 q4.5 -6.5 9 0" /></g>,
    reassuring: <g {...stroke}><path d="M44 78.5 q4 3.6 8 0" /><path d="M68 78.5 q4 3.6 8 0" /></g>,
    resting: <g {...stroke}><path d="M44 80 h8" /><path d="M68 80 h8" /></g>,
  };
  const brows: Partial<Record<BaoMood, ReactNode>> = {
    curious: <path d="M67.5 69.5 q4.5 -3.6 9.5 -1.4" {...stroke} strokeWidth={2.4} />,
    thinking: <><path d="M44.5 70.5 h8" {...stroke} strokeWidth={2.4} /><path d="M68.5 68.5 q4.5 -3.4 9 -1" {...stroke} strokeWidth={2.4} /></>,
    confused: <><path d="M43.5 69.5 q4.5 -3.6 9.5 -1" {...stroke} strokeWidth={2.4} /><path d="M67.5 73 l9 -1.8" {...stroke} strokeWidth={2.4} /></>,
  };
  const openMouth = (w: number, h: number) => (
    <g>
      <path d={`M${60 - w} 86 C${60 - w} ${86 + h} ${60 + w} ${86 + h} ${60 + w} 86 Z`} fill={BAO.ink} strokeLinejoin="round" stroke={BAO.ink} strokeWidth="1.2" />
      <ellipse cx="60" cy={86 + h * 0.56} rx={w * 0.5} ry={h * 0.16} fill={BAO.mouth} />
    </g>
  );
  const mouth: Record<BaoMood, ReactNode> = {
    welcoming: <path d="M54 87.5 q6 5 12 0" {...stroke} />,
    curious: <ellipse cx="60" cy="89.5" rx="2.4" ry="2.9" fill={BAO.ink} />,
    thinking: <path d="M59 90 h7.5" {...stroke} />,
    confused: <path d="M52.5 90 q2.5 -2.6 5 0 t5 0 t5 0" {...stroke} strokeWidth={2.5} />,
    encouraging: openMouth(6.5, 9),
    celebrating: openMouth(8, 12),
    reassuring: <path d="M55.5 87.5 q4.5 3.6 9 0" {...stroke} />,
    resting: <path d="M58 89 q2 1.6 4 0" {...stroke} strokeWidth={2.4} />,
  };

  // Hands are small mittens with no arm, so a raised hand never reads as a handle.
  const hand = (x: number, y: number, angle = 0, rx = 6, ry = 9) => (
    <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={BAO.crust} transform={`rotate(${angle} ${x} ${y})`} />
  );

  // A tap wins; otherwise the page's motion; otherwise a slow idle sway, so Bao is never a sticker.
  const motionClass = beaming ? "bun-hop" : motion === "breathe" ? "bun-breathe" : motion === "hop" ? "bun-hop" : motion === "nod" ? "bun-nod" : size >= 28 ? "bun-idle" : "";
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": LABEL[mood] };
  // Idle Baos start at different points of the sway, so two on a page never move in step.
  const phase = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);

  return (
    <svg
      key={tap}
      ref={svg}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`${motionClass} ${className}`}
      style={motionClass === "bun-idle" ? { animationDelay: `-${phase * 7}ms` } : undefined}
      onPointerDown={() => {
        setTap((n) => n + 1);
        setBeaming(true);
      }}
      {...a11y}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {ground && <ellipse cx="60" cy="110" rx="38" ry="3.6" fill={BAO.ink} opacity="0.13" />}

      <g transform={`translate(0 2)${tilt ? ` rotate(${tilt} 60 104)` : ""}`}>
        {/* arms that sit behind the body */}
        {(pose === "wave" || pose === "cheer") && hand(111, 77, 40, 5.6, 10.5)}
        {pose === "cheer" && hand(9, 77, -40, 5.6, 10.5)}

        {/* the bun: crust underneath, lit dough on top, one highlight, three seeds */}
        <g clipPath={`url(#${id}-body)`}>
          <rect x="0" y="34" width="120" height="76" fill={BAO.crust} />
          <path d={BODY} fill={BAO.dough} transform="translate(-4.5 -4)" />
          <g fill={BAO.seed}>
            <ellipse cx="29.5" cy="60" rx="1.5" ry="2.7" transform="rotate(-42 29.5 60)" />
            <ellipse cx="35.5" cy="53" rx="1.5" ry="2.7" transform="rotate(-30 35.5 53)" />
            <ellipse cx="37" cy="61" rx="1.5" ry="2.7" transform="rotate(-50 37 61)" />
          </g>
        </g>

        {/* hat: the outer group takes the motion, the inner one the lean */}
        <g className="bun-hat">
          <g transform="translate(60 45) scale(1.1) translate(-60 -45) rotate(-6 60 50)">
            <path d="M45 24 H75 L74.6 42.5 Q74.5 45 72 45 H48 Q45.5 45 45.4 42.5 Z" fill={BAO.hat} />
            <g stroke={BAO.hatShade} strokeWidth="2.2" strokeLinecap="round">
              <path d="M53 29.5 V37.5" />
              <path d="M60 29 V37.5" />
              <path d="M67 29.5 V37.5" />
            </g>
            <path d="M44 27 C36 26.5 33.5 16.5 41 12.5 C43.5 6 53.5 3.5 60 7.5 C67 2.5 80 5.5 81.5 14 C89 16.5 88.5 27 79 27.8 C69 29 55 29 44 27 Z" fill={BAO.hat} />
            <path d="M44 27 C55 29 69 29 79 27.8 C83.5 27.3 86.5 24.5 87 21 C83.5 24 77 24.6 69 24.8 C60 25 51 25 43 23.8 C43.2 25.4 43.6 26.4 44 27 Z" fill={BAO.hatShade} />
            <rect x="45.4" y="39" width="29.2" height="6" rx="2.2" fill={BAO.band} />
          </g>
        </g>

        {/* face */}
        {!covered && <g className={blink ? "bun-blink" : undefined}>{eyes[shown]}</g>}
        {!covered && brows[shown]}
        {mouth[shown]}

        {mood === "thinking" && pose !== "think" && (
          <g fill={BAO.ink} opacity="0.28">
            <circle cx="94" cy="52" r="1.8" />
            <circle cx="100" cy="45" r="2.4" />
            <circle cx="107" cy="37" r="3" />
          </g>
        )}

        {/* arms in front of the body */}
        {pose === "think" && hand(71, 95.5, -60, 5.5, 7.5)}
        {covered && (
          <>
            {hand(47.5, 79, -20, 9, 8)}
            {hand(72.5, 79, 20, 9, 8)}
          </>
        )}
        {pose === "hold" && (
          <>
            <Prop prop={prop} />
            {prop === "spoon" ? (
              hand(93, 96.5, 30, 5.4, 7.4)
            ) : (
              <>
                {hand(45.5, 99.5, -55, 5.2, 7)}
                {hand(74.5, 99.5, 55, 5.2, 7)}
              </>
            )}
          </>
        )}
      </g>
    </svg>
  );
}

/** What Bao holds: a spoon raised at its side, or something between its hands at the front. */
function Prop({ prop }: { prop: BaoProp }) {
  switch (prop) {
    case "spoon":
      return (
        <g transform="rotate(16 92 100)">
          <rect x="89.8" y="72" width="4.4" height="38" rx="2.2" fill="#b4733a" />
          <ellipse cx="92" cy="66" rx="6.5" ry="8.5" fill="#cd8a48" />
          <ellipse cx="92" cy="65" rx="4" ry="5.6" fill="#b4733a" opacity="0.45" />
        </g>
      );
    case "basket":
      return (
        <g>
          <path d="M48.5 96.5 q11.5 -15 23 0" fill="none" stroke="#a86e33" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="54" cy="93.5" r="4.6" fill="#e0532c" />
          <ellipse cx="63.5" cy="92" rx="5.2" ry="3" fill="#3c8a55" transform="rotate(-32 63.5 92)" />
          <circle cx="69" cy="94.5" r="3.6" fill="#f2bc62" />
          <path d="M43 96 H77 L73.6 108.5 Q73 111 70.4 111 H49.6 Q47 111 46.4 108.5 Z" fill="#c98a45" />
          <path d="M45.5 101.5 H74.5 M47 106 H73" stroke="#a86e33" strokeWidth="1.5" />
        </g>
      );
    case "receipt":
      return (
        <g>
          <path d="M47 86 H73 V110 l-3.25 -2.4 -3.25 2.4 -3.25 -2.4 -3.25 2.4 -3.25 -2.4 -3.25 2.4 -3.25 -2.4 L47 110 Z" fill="#ffffff" />
          <path d="M51.5 92 H68.5 M51.5 97 H63.5 M51.5 102 H66.5" stroke="#b9ae9c" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "timer":
      return (
        <g>
          <rect x="56.5" y="84.5" width="7" height="4" rx="1.5" fill={BAO.ink} />
          <circle cx="60" cy="99" r="11.5" fill="#ffffff" stroke={BAO.ink} strokeWidth="2.6" />
          <path d="M60 92.5 V99 L64.5 101.8" fill="none" stroke={BAO.mouth} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    default:
      return null;
  }
}

/**
 * Bao says one line: the bun and a speech bubble. Use it for empty states, waits and milestones,
 * one per screen; the line is specific to what just happened, warm and a little dry.
 */
export function BaoSays({
  children,
  mood = "welcoming",
  pose = "rest",
  prop = "none",
  motion = "none",
  size = 60,
  className = "",
}: {
  children: ReactNode;
  mood?: BaoMood;
  pose?: BaoPose;
  prop?: BaoProp;
  motion?: BaoMotion;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-2.5 ${className}`}>
      <Bao mood={mood} pose={pose} prop={prop} motion={motion} size={size} className="shrink-0" />
      <p className="mb-3 min-w-0 rounded-[20px] rounded-bl-md border border-line bg-surface px-4 py-3 text-[15px] leading-snug text-foreground">
        {children}
      </p>
    </div>
  );
}

/** A smaller aside from Bao inside content (a tip, an answer), without the bubble. */
export function BaoNote({ children, mood = "welcoming", className = "" }: { children: ReactNode; mood?: BaoMood; className?: string }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <Bao mood={mood} size={36} ground={false} decorative className="-mt-1 shrink-0" />
      <div className="min-w-0 flex-1 text-[15px] leading-snug">{children}</div>
    </div>
  );
}
