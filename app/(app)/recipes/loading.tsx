import { maru } from "./font";
import { Mascot } from "./Mascot";
import { FunStyles, ui } from "./fun";

export default function Loading() {
  return (
    <div className={`${ui.page} ${maru.className}`}>
      <FunStyles />
      <section className="mx-auto flex w-full max-w-5xl items-center gap-3 p-6" role="status">
        <Mascot mood="thinking" size={56} className="cooky-float" />
        <p className="font-bold">Bao is fetching the recipes…</p>
      </section>
    </div>
  );
}
