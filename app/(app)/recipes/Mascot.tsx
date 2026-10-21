// Owner: Recipes & Cook. "Bao", Cooky's original mascot: a round steamed bun in a chef's hat.
// Five moods for the cook journey. Pure SVG, no images, so it scales and themes cleanly.
export type Mood = "happy" | "thinking" | "cheer" | "worried" | "proud";

export function Mascot({ mood = "happy", size = 56, className = "" }: { mood?: Mood; size?: number; className?: string }) {
  const eyes = {
    happy: <><path d="M38 58 q4 -5 8 0" /><path d="M58 58 q4 -5 8 0" /></>,
    proud: <><path d="M37 57 h10" /><path d="M57 57 h10" /></>,
    cheer: <><path d="M37 60 l5 -6 l5 6" /><path d="M57 60 l5 -6 l5 6" /></>,
    thinking: <><circle cx="42" cy="57" r="2.6" fill="#3b2f2f" stroke="none" /><circle cx="64" cy="54" r="2.6" fill="#3b2f2f" stroke="none" /></>,
    worried: <><circle cx="42" cy="59" r="2.6" fill="#3b2f2f" stroke="none" /><circle cx="62" cy="59" r="2.6" fill="#3b2f2f" stroke="none" /><path d="M36 53 q4 -3 9 -4" /><path d="M68 53 q-4 -3 -9 -4" /></>,
  }[mood];
  const mouth = {
    happy: <path d="M46 67 q6 6 12 0" />,
    proud: <path d="M45 66 q7 8 14 0 z" fill="#e86a5b" />,
    cheer: <path d="M44 65 q8 11 16 0 z" fill="#e86a5b" />,
    thinking: <path d="M48 69 h8" />,
    worried: <path d="M47 69 q5 -3 10 0" />,
  }[mood];
  return (
    <svg width={size} height={size} viewBox="0 0 104 104" role="img" aria-label={`Bao the chef, ${mood}`} className={className}>
      {/* hat */}
      <g fill="#fff" stroke="#e7dccb" strokeWidth="2">
        <circle cx="38" cy="22" r="11" />
        <circle cx="52" cy="16" r="13" />
        <circle cx="66" cy="22" r="11" />
        <rect x="34" y="22" width="36" height="16" rx="4" />
      </g>
      {/* bun */}
      <path d="M14 70 C14 46 30 34 52 34 C74 34 90 46 90 70 C90 86 74 94 52 94 C30 94 14 86 14 70 Z" fill="#fff4e0" stroke="#f0d9b5" strokeWidth="2.5" />
      <path d="M44 38 q8 6 16 0" stroke="#f0d9b5" strokeWidth="2" fill="none" />
      {/* cheeks */}
      <ellipse cx="32" cy="68" rx="6" ry="4" fill="#FFB7C5" opacity="0.8" />
      <ellipse cx="72" cy="68" rx="6" ry="4" fill="#FFB7C5" opacity="0.8" />
      <g stroke="#3b2f2f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {eyes}
        {mouth}
      </g>
      {mood === "thinking" && <text x="80" y="40" fontSize="16" fill="#8b5cf6">?</text>}
      {mood === "cheer" && <text x="80" y="42" fontSize="14">✨</text>}
      {mood === "worried" && <path d="M80 44 q3 6 0 9 q-3 -3 0 -9" fill="#93c5fd" />}
    </svg>
  );
}
