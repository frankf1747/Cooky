"use client";
// Owner: Platform. The two states every route needs and nobody should redesign per page:
// a page that failed to load (Bao puzzled, what happened, that nothing changed, and a retry that
// is disabled while it runs), and a page that is loading (a skeleton in the shape of the page).
// Each route's error.tsx and loading.tsx is one line around these.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Bao } from "./Bao";
import { btnPrimary, btnSecondary, skeleton } from "./styles";

export function ErrorState({
  title,
  children,
  error,
  retry,
  back,
}: {
  title: string;
  /** What went wrong and what did not change, in a sentence or two. */
  children: ReactNode;
  error?: unknown;
  retry: () => void;
  back?: { href: string; label: string };
}) {
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-32 pt-10 sm:px-6 sm:pt-16">
      <Bao mood="confused" size={104} />
      <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">{title}</h1>
      <p role="alert" className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted sm:text-base">{children}</p>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <button
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            retry();
          }}
          className={btnPrimary}
        >
          {retrying ? "Trying again…" : "Try again"}
        </button>
        {back && <Link href={back.href} className={btnSecondary}>{back.label}</Link>}
      </div>
    </section>
  );
}

/**
 * A loading page: a title bar and blocks in the rough shape of what is coming. `layout` picks
 * the shape: a list, a grid of cards, or a single focused card.
 */
export function PageSkeleton({ layout = "list", label = "Loading", width = "normal" }: { layout?: "list" | "grid" | "focus" | "form"; label?: string; width?: "narrow" | "normal" | "wide" }) {
  const w = width === "narrow" ? "max-w-2xl" : width === "wide" ? "max-w-6xl" : "max-w-4xl";
  return (
    <section className={`mx-auto w-full ${w} px-4 pb-32 pt-6 sm:px-6 sm:pt-10 lg:px-8`} aria-busy="true" aria-label={label}>
      <div className={`${skeleton} h-3 w-24`} />
      <div className={`${skeleton} mt-4 h-9 w-64 max-w-full sm:h-11`} />
      <div className={`${skeleton} mt-4 h-4 w-80 max-w-full`} />
      {layout === "grid" && (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i}>
              <div className="skeleton shape-dome aspect-[4/3] w-full" />
              <div className={`${skeleton} mt-3 h-4 w-4/5`} />
              <div className={`${skeleton} mt-2 h-3 w-1/2`} />
            </div>
          ))}
        </div>
      )}
      {layout === "list" && (
        <div className="mt-10 grid gap-3">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className={`${skeleton} h-16 rounded-2xl`} />)}
        </div>
      )}
      {layout === "focus" && (
        <>
          <div className={`${skeleton} mt-10 h-56 rounded-3xl`} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className={`${skeleton} h-32 rounded-2xl`} />
            <div className={`${skeleton} h-32 rounded-2xl`} />
          </div>
        </>
      )}
      {layout === "form" && (
        <div className="mt-10 grid gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${skeleton} h-12`} />)}
          </div>
          <div className={`${skeleton} h-28 rounded-2xl`} />
          <div className={`${skeleton} h-28 rounded-2xl`} />
        </div>
      )}
    </section>
  );
}
