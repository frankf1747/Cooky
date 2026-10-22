// Owner: Platform. "Bao", Cooky's bun: the voice of the app. Drawn by Recipes & Cook for v1
// (#24) and redrawn here as a proper 2D illustration: a steamed bun with soft shading, pleats
// peeking out under the hat, glossy eyes, blushed cheeks and, at `detail="rich"`, a paper grain.
// Moods, poses (wave, hold, cover its eyes), props (spoon, basket, receipt, timer), eyes that can
// look somewhere, and small motion (bob, blink, a one-shot wiggle) that stops under reduced
// motion. Pure SVG, so it scales and works in both colour schemes. The label says what Bao is
// doing, for screen readers; decorative uses pass `decorative`.
import { useId, type ReactNode } from "react";

export type BaoMood = "happy" | "look" | "thinking" | "cheer" | "worried" | "proud" | "sleepy";
export type BaoPose = "rest" | "wave" | "hold" | "cover";
export type BaoProp = "none" | "spoon" | "basket" | "receipt" | "timer";
export type BaoMotion = "none" | "bob" | "wiggle";

const LABEL: Record<BaoMood, string> = {
  happy: "Bao, happy",
  look: "Bao, watching",
  thinking: "Bao, thinking",
  cheer: "Bao, cheering",
  worried: "Bao, concerned",
  proud: "Bao, proud",
  sleepy: "Bao, dozing",
};

const INK = "#3b2f2f";
const LINE = "#e3c493";
const BODY = "M18 76 C18 48 36 36 60 36 C84 36 102 48 102 76 C102 96 84 106 60 106 C36 106 18 96 18 76 Z";

export function Bao({
  mood = "happy",
  pose = "rest",
  prop = "none",
  motion = "none",
  detail = "plain",
  look,
  size = 40,
  className = "",
  decorative = false,
}: {
  mood?: BaoMood;
  pose?: BaoPose;
  prop?: BaoProp;
  motion?: BaoMotion;
  /** "rich" adds paper grain and a second highlight; use it for one big Bao, not a grid of small ones. */
  detail?: "plain" | "rich";
  /** Where the eyes look, each axis -1..1. Only the "look" mood has pupils. */
  look?: { x: number; y: number };
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const lx = Math.max(-1, Math.min(1, look?.x ?? 0)) * 3;
  const ly = Math.max(-1, Math.min(1, look?.y ?? 0)) * 2.5;
  const covered = pose === "cover";

  const eyes: Record<BaoMood, ReactNode> = {
    look: (
      <g className="bao-blink">
        <ellipse cx="46" cy="66" rx="7" ry="8" fill="#fff" stroke={INK} strokeWidth="2" />
        <ellipse cx="74" cy="66" rx="7" ry="8" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx={46 + lx} cy={66 + ly} r="3.8" fill="#4a3728" />
        <circle cx={74 + lx} cy={66 + ly} r="3.8" fill="#4a3728" />
        <circle cx={46 + lx} cy={66 + ly} r="2.2" fill={INK} />
        <circle cx={74 + lx} cy={66 + ly} r="2.2" fill={INK} />
        <circle cx={44.4 + lx} cy={64.2 + ly} r="1.7" fill="#fff" />
        <circle cx={72.4 + lx} cy={64.2 + ly} r="1.7" fill="#fff" />
      </g>
    ),
    happy: <><path d="M40 66 q6 -6 12 0" /><path d="M68 66 q6 -6 12 0" /></>,
    proud: <><path d="M40 65 h12" /><path d="M68 65 h12" /></>,
    cheer: <><path d="M40 68 l6 -7 l6 7" /><path d="M68 68 l6 -7 l6 7" /></>,
    thinking: <><circle cx="46" cy="66" r="2.8" fill={INK} stroke="none" /><circle cx="74" cy="63" r="2.8" fill={INK} stroke="none" /><path d="M66 55 q8 -4 14 0" /></>,
    worried: <><circle cx="46" cy="67" r="2.8" fill={INK} stroke="none" /><circle cx="74" cy="67" r="2.8" fill={INK} stroke="none" /><path d="M39 60 q5 -3 11 -2" /><path d="M81 60 q-5 -3 -11 -2" /></>,
    sleepy: <><path d="M40 67 q6 4 12 0" /><path d="M68 67 q6 4 12 0" /></>,
  };
  const mouth: Record<BaoMood, ReactNode> = {
    look: <path d="M54 84 q6 4 12 0" />,
    happy: <path d="M52 83 q8 7 16 0" />,
    proud: <path d="M51 82 q9 9 18 0 z" fill="#e86a5b" />,
    cheer: <path d="M50 81 q10 13 20 0 z" fill="#e86a5b" />,
    thinking: <path d="M54 86 h12" />,
    worried: <path d="M53 86 q7 -4 14 0" />,
    sleepy: <ellipse cx="60" cy="86" rx="3.5" ry="4.5" fill="#e86a5b" stroke="none" />,
  };

  const motionClass = motion === "bob" ? "bao-bob" : motion === "wiggle" ? "bao-wiggle" : "";
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": LABEL[mood] };

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={`${motionClass} ${className}`} {...a11y}>
      <defs>
        {/* the bun: lit from the top left, warm in the fold at the bottom */}
        <radialGradient id={`${id}-body`} cx="40%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.55" stopColor="var(--bao-body)" />
          <stop offset="1" stopColor="#efd3aa" />
        </radialGradient>
        <linearGradient id={`${id}-hat`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9ebef" />
        </linearGradient>
        <radialGradient id={`${id}-cheek`}>
          <stop offset="0" stopColor="#ffa9bb" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffa9bb" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={BODY} />
        </clipPath>
        {detail === "rich" && (
          <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        )}
      </defs>

      {/* hat */}
      <g fill={`url(#${id}-hat)`} stroke="#dfd4c4" strokeWidth="2">
        <circle cx="44" cy="24" r="11" />
        <circle cx="60" cy="18" r="13" />
        <circle cx="76" cy="24" r="11" />
        <rect x="40" y="24" width="40" height="16" rx="5" />
      </g>
      <path d="M46 36 h28" stroke="#dfd4c4" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />

      {/* arms behind the body: a wave, or two arms reaching forward to hold something */}
      {pose === "wave" && <path d="M98 74 q16 -6 12 -24" fill="none" stroke={LINE} strokeWidth="7" strokeLinecap="round" />}
      {pose === "wave" && <circle cx="110" cy="48" r="6" fill="var(--bao-body)" stroke={LINE} strokeWidth="2.5" />}

      {/* body, its shading, and the pleats peeking out under the hat */}
      <path d={BODY} fill={`url(#${id}-body)`} stroke={LINE} strokeWidth="2.5" />
      {detail === "rich" && (
        <g clipPath={`url(#${id}-clip)`} style={{ mixBlendMode: "multiply" }} opacity="0.14">
          <rect x="18" y="36" width="84" height="70" filter={`url(#${id}-grain)`} />
        </g>
      )}
      <ellipse cx="46" cy="50" rx="12" ry="6" fill="#fff" opacity={detail === "rich" ? 0.55 : 0.4} />
      <g fill="none" stroke={LINE} strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
        <path d="M44 41 q-7 4 -11 11" />
        <path d="M52 41 q-3 5 -4 11" />
        <path d="M68 41 q3 5 4 11" />
        <path d="M76 41 q7 4 11 11" />
      </g>
      <path d="M26 92 q34 14 68 0" fill="none" stroke="#e9c79a" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />

      {/* cheeks */}
      <circle cx="38" cy="78" r="8" fill={`url(#${id}-cheek)`} />
      <circle cx="82" cy="78" r="8" fill={`url(#${id}-cheek)`} />

      {/* face */}
      <g stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {!covered && eyes[mood]}
        {mouth[mood]}
      </g>

      {/* thinking bubbles, a worried drop, a sleepy "z" */}
      {mood === "thinking" && !covered && (
        <g fill="#a8d8ea">
          <circle cx="90" cy="50" r="2" />
          <circle cx="97" cy="42" r="3" />
          <circle cx="106" cy="32" r="4" />
        </g>
      )}
      {mood === "worried" && <path d="M90 52 q3 6 0 9 q-3 -3 0 -9" fill="#a8d8ea" />}
      {mood === "sleepy" && (
        <g fill="none" stroke="#a8d8ea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M92 44 h7 l-7 7 h7" />
          <path d="M103 32 h5 l-5 5 h5" />
        </g>
      )}

      {/* hands over the eyes */}
      {covered && (
        <g fill="var(--bao-body)" stroke={LINE} strokeWidth="2.5">
          <path d="M22 86 q6 -22 24 -20" fill="none" strokeWidth="7" strokeLinecap="round" />
          <path d="M98 86 q-6 -22 -24 -20" fill="none" strokeWidth="7" strokeLinecap="round" />
          <circle cx="46" cy="66" r="9" />
          <circle cx="74" cy="66" r="9" />
        </g>
      )}

      {/* holding something in front */}
      {pose === "hold" && (
        <g>
          <path d="M26 86 q8 10 22 12" fill="none" stroke={LINE} strokeWidth="7" strokeLinecap="round" />
          <path d="M94 86 q-8 10 -22 12" fill="none" stroke={LINE} strokeWidth="7" strokeLinecap="round" />
          {prop === "spoon" && (
            <g transform="rotate(-20 60 100)">
              <rect x="57" y="80" width="6" height="30" rx="3" fill="#c9a06a" />
              <ellipse cx="60" cy="78" rx="8" ry="6" fill="#d9b27c" stroke="#b58a52" strokeWidth="1.5" />
            </g>
          )}
          {prop === "basket" && (
            <g>
              <path d="M42 94 h36 l-4 16 h-28 z" fill="#d9b27c" stroke="#b58a52" strokeWidth="1.5" />
              <path d="M48 94 q12 -14 24 0" fill="none" stroke="#b58a52" strokeWidth="2.5" />
              <circle cx="52" cy="92" r="4" fill="#e86a5b" />
              <circle cx="62" cy="90" r="4" fill="#7cc47f" />
            </g>
          )}
          {prop === "receipt" && (
            <g>
              <path d="M46 88 h28 v24 l-4 -3 -4 3 -4 -3 -4 3 -4 -3 -4 3 -4 -3 z" fill="#fff" stroke="#9a9db0" strokeWidth="1.5" />
              <path d="M51 94 h18 M51 99 h12 M51 104 h16" stroke="#9a9db0" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}
          {prop === "timer" && (
            <g>
              <circle cx="60" cy="100" r="12" fill="#fff" stroke={INK} strokeWidth="2.5" />
              <path d="M60 92 v8 l5 3" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
              <path d="M56 86 h8" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

/** Bao says one line: the bun and a speech bubble. The bubble carries the page's voice. */
export function BaoSays({
  children,
  mood = "happy",
  pose = "rest",
  prop = "none",
  motion = "none",
  size = 56,
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
    <div className={`flex items-end gap-3 ${className}`}>
      <Bao mood={mood} pose={pose} prop={prop} motion={motion} size={size} className="shrink-0" />
      <p className="relative min-w-0 rounded-2xl rounded-bl-md border border-zinc-200 bg-surface px-4 py-3 text-[15px] leading-snug dark:border-zinc-800">
        {children}
      </p>
    </div>
  );
}
