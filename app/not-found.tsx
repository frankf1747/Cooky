// Owner: Platform. Any address that leads nowhere, signed in or not.
import Link from "next/link";
import { Wordmark } from "@/ui/AppNav";
import { Bao } from "@/ui/Bao";
import { btnPrimary, btnSecondary, h1 } from "@/ui/styles";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 sm:px-6">
      <header className="flex h-16 items-center">
        <Link href="/" aria-label="Cooky, home" className="rounded-full"><Wordmark /></Link>
      </header>
      <div className="flex flex-1 flex-col justify-center py-10">
        <Bao mood="confused" size={140} />
        <p className="mt-4 text-[13px] font-medium text-muted">Page not found</p>
        <h1 className={`${h1} mt-2`}>This page isn&apos;t on the menu.</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">The link may be old, or the plan or recipe was removed. Nothing in your fridge changed.</p>
        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
          <Link href="/fridge" className={btnPrimary}>Open the fridge</Link>
          <Link href="/recipes" className={btnSecondary}>Browse recipes</Link>
        </div>
      </div>
    </main>
  );
}
