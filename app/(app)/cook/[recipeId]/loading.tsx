// Owner: Recipes & Cook. Shown while cook mode loads.
import { maru } from "../../recipes/font";
import { FunStyles, ui } from "../../recipes/fun";
import { Mascot } from "../../recipes/Mascot";

export default function Loading() {
  return (
    <div className={`${ui.page} ${maru.className}`}>
      <FunStyles />
      <section className="mx-auto flex w-full max-w-xl items-center gap-3 p-6" role="status">
        <Mascot mood="thinking" size={56} className="cooky-float" />
        <p className="font-bold">Bao is tying on an apron… getting the recipe ready</p>
      </section>
    </div>
  );
}
