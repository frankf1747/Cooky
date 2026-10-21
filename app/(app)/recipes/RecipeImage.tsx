// Owner: Recipes & Cook. A recipe's photo, or a plain placeholder until dish images exist.
// (Dish visuals are a later design task; the placeholder keeps every card the same shape.)

export function RecipeImage({ imageUrl, title, className = "aspect-[4/3] w-full" }: { imageUrl: string | null; title: string; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external https images from the seed, no loader configured
    return <img src={imageUrl} alt={title} className={`rounded-md object-cover ${className}`} />;
  }
  return (
    <div
      role="img"
      aria-label={`${title}: no photo yet`}
      className={`flex items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-100 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 ${className}`}
    >
      Photo coming soon
    </div>
  );
}
