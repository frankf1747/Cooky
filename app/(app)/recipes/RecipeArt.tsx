// Owner: Recipes & Cook. A cheerful cover for recipes without a photo: the dish's emoji on a soft
// pastel. The color comes from the recipe id, so each dish keeps the same look on every visit.
import { dishEmoji, ui } from "./fun";

const BACKGROUNDS = ["bg-[#EAF6FB]", "bg-[#FFF0F3]", "bg-[#FFF7E0]", "bg-[#EEF0FB]", "bg-[#E3F2FA]", "bg-[#FDEFF7]"] as const;

export function RecipeArt({ id, title, className = "aspect-[4/3]" }: { id: string; title: string; className?: string }) {
  const n = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <div aria-hidden className={`flex w-full items-center justify-center border-2 border-[#34374A]/15 ${ui.wobbleSm} ${BACKGROUNDS[n % BACKGROUNDS.length]} ${className}`}>
      <span className="text-5xl drop-shadow-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">{dishEmoji(title)}</span>
    </div>
  );
}
