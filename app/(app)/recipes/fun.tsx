// Owner: Recipes & Cook. The look of the recipe and cook pages: a sky-blue and sakura palette on
// paper, hand-drawn shapes, small doodles, an emoji per dish, cheers between steps, and the few
// keyframe animations the pages use (scoped by a cooky- prefix).

/** Palette (sky blue × sakura on paper). Class strings live here so Tailwind sees them. */
export const ui = {
  /** a whole page on dotted paper */
  page: "flex-1 bg-[#F7F9FC] text-[#34374A] [background-image:radial-gradient(#A8D8EA66_1px,transparent_1px)] [background-size:18px_18px]",
  /** hand-drawn rounded corners, big and small */
  wobble: "rounded-[28px_10px_26px_12px/12px_26px_10px_28px]",
  wobbleSm: "rounded-[16px_6px_14px_7px/7px_14px_6px_16px]",
  /** ink outline only; add a background and shadow yourself */
  frame: "border-2 border-[#34374A]",
  card: "border-2 border-[#34374A] bg-white shadow-[4px_4px_0_0_#A8D8EA]",
  cardSoft: "border-2 border-dashed border-[#A8D8EA] bg-white",
  btn: "border-2 border-[#34374A] bg-[#6C8EBF] font-bold text-white shadow-[3px_3px_0_0_#34374A] transition hover:-translate-y-0.5 hover:bg-[#5F82B5] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
  btnGhost: "border-2 border-[#34374A] bg-white font-bold text-[#34374A] shadow-[3px_3px_0_0_#A8D8EA] transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40",
  btnSakura: "border-2 border-[#34374A] bg-[#FFB7C5] font-bold text-[#34374A] shadow-[3px_3px_0_0_#34374A] transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
  chip: "border-2 border-[#34374A]/70 bg-white text-[#34374A] transition hover:-translate-y-0.5 hover:bg-[#EAF6FB] active:scale-95",
  chipOn: "border-2 border-[#34374A] bg-[#A8D8EA] font-bold text-[#34374A] shadow-[2px_2px_0_0_#34374A]",
  tag: "bg-[#FFE4EA] text-[#B4536C]",
  muted: "text-[#6B6F86]",
  heading: "font-bold tracking-tight text-[#34374A]",
  link: "font-bold text-[#4F6FA3] underline decoration-[#FFB7C5] decoration-2 underline-offset-4",
} as const;

/** A little sakura blossom doodle. */
export function Sakura({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 40 40" className={className}>
      {[0, 72, 144, 216, 288].map((r) => (
        <path key={r} d="M20 20 C14 12 15 4 20 6 C25 4 26 12 20 20 Z" fill="#FFB7C5" stroke="#E58AA0" strokeWidth="1.2" transform={`rotate(${r} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="3" fill="#F2C14E" />
    </svg>
  );
}

/** A hand-drawn steam squiggle (three wavy lines). */
export function Steam({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden width="34" height="28" viewBox="0 0 34 28" className={className} fill="none" stroke="#A8D8EA" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 26 q-4 -6 0 -11 q4 -5 0 -11" />
      <path d="M17 26 q-4 -6 0 -11 q4 -5 0 -11" />
      <path d="M28 26 q-4 -6 0 -11 q4 -5 0 -11" />
    </svg>
  );
}

/** A strip of washi tape for the top of a card. */
export function Washi({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`absolute h-4 w-16 rotate-[-6deg] bg-[#FFB7C5]/70 [background-image:repeating-linear-gradient(45deg,#ffffff55_0_4px,transparent_4px_8px)] ${className}`} />;
}

/** A dish emoji from the title, so new recipes get one without a data change. */
export function dishEmoji(title: string): string {
  const t = title.toLowerCase();
  const rules: [RegExp, string][] = [
    [/oyakodon|donburi/, "🍱"], [/noodle|ramen|udon/, "🍜"], [/quesadilla/, "🫓"], [/shakshuka/, "🥘"], [/taco/, "🌮"], [/salmon|fish/, "🐟"], [/curry/, "🍛"], [/fried rice/, "🍚"], [/frittata|omelet/, "🍳"],
    [/spaghetti|pasta/, "🍝"], [/beef.*bowl/, "🍚"], [/fajita|bowl/, "🥙"], [/hash|potato/, "🥔"], [/tomato/, "🍅"], [/chicken/, "🍗"],
    [/beef/, "🥩"], [/egg/, "🥚"], [/salad/, "🥗"], [/soup/, "🍲"],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? "🍽️";
}

/** Encouragement shown on the step card. */
export function stepCheer(index: number, total: number): string {
  if (total <= 1) return "One step and dinner's ready!";
  if (index === 0) return "Let's cook! 🔥";
  if (index === total - 1) return "Last step, you've got this! 💪";
  if (index === Math.floor((total - 1) / 2)) return "Halfway there 🎉";
  return `Nice! ${total - index - 1} more to go`;
}

const CSS = `
@keyframes cooky-pop { 0% { transform: scale(.92); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes cooky-slide { 0% { transform: translateX(18px); opacity: 0 } 100% { transform: none; opacity: 1 } }
@keyframes cooky-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes cooky-wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-8deg) } 75% { transform: rotate(8deg) } }
@keyframes cooky-fall { 0% { transform: translateY(-20vh) rotate(0); opacity: 1 } 100% { transform: translateY(80vh) rotate(540deg); opacity: 0 } }
@keyframes cooky-dot { 0%,80%,100% { opacity: .25 } 40% { opacity: 1 } }
.cooky-pop { animation: cooky-pop .35s ease-out both }
.cooky-slide { animation: cooky-slide .35s ease-out both }
.cooky-float { animation: cooky-float 3s ease-in-out infinite }
.cooky-wiggle { animation: cooky-wiggle .6s ease-in-out 3 }
.cooky-dot { animation: cooky-dot 1.2s infinite }
@media (prefers-reduced-motion: reduce) { .cooky-pop,.cooky-slide,.cooky-float,.cooky-wiggle,.cooky-dot,.cooky-confetti span { animation: none !important } }
`;

export function FunStyles() {
  return <style>{CSS}</style>;
}

/** A short emoji shower for finishing a dish. Decorative only. */
export function Confetti() {
  const bits = ["🌸", "✨", "🎉", "🍙", "⭐", "💙", "🌸", "✨", "🌟", "🥢", "🎊", "🌸"];
  return (
    <div aria-hidden className="cooky-confetti pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-0 text-2xl"
          style={{ left: `${(i * 83) % 100}%`, animation: `cooky-fall ${1.6 + (i % 4) * 0.35}s ease-in ${(i % 5) * 0.12}s both` }}
        >
          {b}
        </span>
      ))}
    </div>
  );
}

/** "Typing" dots while the coach reads the recipe. */
export function ThinkingDots() {
  return (
    <span aria-hidden className="inline-flex gap-1">
      {[0, 1, 2].map((i) => <span key={i} className="cooky-dot h-1.5 w-1.5 rounded-full bg-[#E58AA0]" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </span>
  );
}
