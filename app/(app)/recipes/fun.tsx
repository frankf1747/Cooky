// Owner: Recipes & Cook. Small touches that make Cooky feel friendly: an emoji per dish, cheers
// between steps, and the few keyframe animations the cook pages use (scoped by a cooky- prefix).

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
  const bits = ["🎉", "✨", "🥳", "🍳", "⭐", "💚", "🎊", "✨", "🌟", "🥢", "🎉", "⭐"];
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
      {[0, 1, 2].map((i) => <span key={i} className="cooky-dot h-1.5 w-1.5 rounded-full bg-violet-500" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </span>
  );
}
