// Owner: Recipes & Cook. A recipe's photo in a soft blob, or a blob placeholder with a dozing
// Bao until dish visuals are chosen (lead decision 2026-10-21). Two blob shapes, so a grid of
// placeholders does not look stamped out.
import { Bao } from "@/ui/Bao";

export function RecipeImage({ imageUrl, title, className = "aspect-[4/3] w-full", shape = 0 }: { imageUrl: string | null; title: string; className?: string; shape?: number }) {
  const blob = shape % 2 ? "blob-2" : "blob";
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external https images from the seed, no loader configured
    return <img src={imageUrl} alt="" className={`${blob} object-cover ${className}`} />;
  }
  return (
    <div className={`${blob} flex items-center justify-center bg-surface/70 ${className}`} role="img" aria-label={`No photo yet for ${title}`}>
      <Bao mood="sleepy" size={40} decorative className="opacity-70" />
    </div>
  );
}
