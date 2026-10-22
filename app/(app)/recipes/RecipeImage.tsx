// Owner: Recipes & Cook. A recipe's photo, or its illustration (src/ui/DishArt) until dish
// photography is chosen (lead decision 2026-10-21). Food sits in the bun's dome, the brand's
// frame for food; "round" and "soft" are for thumbnails in lists.
import { DishArt } from "@/ui/DishArt";

const SHAPES = { dome: "shape-dome", soft: "rounded-2xl", round: "rounded-full" } as const;

export function RecipeImage({
  id,
  imageUrl,
  title,
  className = "aspect-[4/3] w-full",
  shape = "dome",
  decorative = true,
}: {
  id: string;
  imageUrl: string | null;
  title: string;
  className?: string;
  shape?: keyof typeof SHAPES;
  /** Next to the recipe's title the picture adds nothing for a screen reader. */
  decorative?: boolean;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external https images from the seed, no loader configured
    return <img src={imageUrl} alt={decorative ? "" : title} className={`${SHAPES[shape]} object-cover ${className}`} />;
  }
  return (
    <div className={`${SHAPES[shape]} overflow-hidden ${className}`} aria-hidden={decorative || undefined}>
      <DishArt id={id} title={title} className="h-full w-full" />
    </div>
  );
}
