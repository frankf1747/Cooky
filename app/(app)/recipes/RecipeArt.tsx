// Owner: Recipes & Cook. A simple plate illustration for recipes without a photo (design frame 3).
// The colors come from the recipe id, so each dish keeps the same look on every visit.
const PALETTES = [
  ["bg-amber-100", "bg-orange-300", "bg-green-500"],
  ["bg-lime-100", "bg-yellow-300", "bg-orange-500"],
  ["bg-orange-100", "bg-orange-400", "bg-green-600"],
  ["bg-rose-100", "bg-red-300", "bg-emerald-500"],
  ["bg-sky-100", "bg-amber-300", "bg-lime-500"],
] as const;

export function RecipeArt({ id }: { id: string }) {
  const n = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const [bg, food, garnish] = PALETTES[n % PALETTES.length];
  return (
    <div aria-hidden className={`flex aspect-[4/3] w-full items-center justify-center rounded-lg ${bg}`}>
      <div className="relative h-14 w-14 rounded-full bg-white shadow-sm">
        <div className={`absolute left-2 top-2.5 h-8 w-9 rounded-full ${food}`} />
        <div className={`absolute bottom-2 right-2 h-5 w-5 rounded-full ${garnish}`} />
      </div>
    </div>
  );
}
