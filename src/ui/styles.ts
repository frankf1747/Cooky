// Owner: Platform. The shared look (AGENTS.md: plain UI). Pages use these strings so buttons,
// fields, chips and panels look and behave the same everywhere. Colours come from the tokens in
// app/globals.css; never pick a colour by hand. Controls are 44px tall on phones (a thumb), 40px
// on larger screens; text fields are 16px on phones so iOS does not zoom into them.

/** The page's main action. */
export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm";
/** Any other action. */
export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-surface px-4 text-[15px] font-medium transition hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm dark:border-zinc-700 dark:hover:bg-zinc-800";
/** A secondary action inside a row or card (Edit, Used, Cancel), where a full-height button is too big. */
export const btnSecondarySm =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-surface px-3 text-sm font-medium transition hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
/** A small, text-only action next to content (a link or a quiet button). */
export const btnText = "font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50";
/** Text inputs, selects and textareas. */
export const field =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-surface px-3 py-2.5 text-base placeholder:text-zinc-500 sm:py-2 sm:text-sm dark:border-zinc-700";
/** A bordered group of related content. */
export const panel = "rounded-lg border border-zinc-200 bg-surface dark:border-zinc-800";
/** Secondary text. */
export const muted = "text-zinc-600 dark:text-zinc-400";
/** A toggle chip (filter, pick), on and off. Pair with `chip`. */
export const chip = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition active:scale-[0.97] sm:py-1";
export const chipOn = "border-accent bg-accent-soft font-medium";
export const chipOff = "border-zinc-300 bg-surface hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500";
/** A row of chips: scrolls sideways on phones, wraps on larger screens. */
export const chipRow = "scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0";
/** A small label that asks for attention: a food to use soon, a Pro feature. */
export const tag = "inline-block rounded-full bg-attention px-2 py-0.5 text-xs font-medium text-attention-ink";
/** An error the user can act on. */
export const alert = "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200";
