// Owner: Recipes & Cook. A cheerful cover for recipes without a photo: the dish's emoji on a soft
// color. The color comes from the recipe id, so each dish keeps the same look on every visit.
import { dishEmoji } from "./fun";

const BACKGROUNDS = ["bg-amber-100", "bg-lime-100", "bg-orange-100", "bg-rose-100", "bg-sky-100", "bg-emerald-100", "bg-violet-100"] as const;

export function RecipeArt({ id, title, className = "aspect-[4/3]" }: { id: string; title: string; className?: string }) {
  const n = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <div aria-hidden className={`flex w-full items-center justify-center rounded-2xl ${BACKGROUNDS[n % BACKGROUNDS.length]} ${className}`}>
      <span className="text-5xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{dishEmoji(title)}</span>
    </div>
  );
}
