// Owner: Platform. The shared look (AGENTS.md: one look). Pages use these strings so buttons,
// fields, chips, tiles and panels look and behave the same everywhere. Colours come from the
// tokens in app/globals.css; never pick a colour by hand. Controls are 44px tall on phones (a
// thumb), 40px on larger screens; text fields are 16px on phones so iOS does not zoom.

/** The page's main action. */
export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm";
/** Any other action. */
export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-surface px-5 text-[15px] font-medium transition hover:bg-zinc-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm dark:border-zinc-700 dark:hover:bg-zinc-800";
/** A secondary action inside a row or card (Edit, Used, Cancel), where a full-height button is too big. */
export const btnSecondarySm =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-surface px-3.5 text-sm font-medium transition hover:bg-zinc-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
/** A small, text-only action next to content (a link or a quiet button). */
export const btnText = "font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50";
/** Text inputs, selects and textareas. */
export const field =
  "w-full min-w-0 rounded-xl border border-zinc-300 bg-surface px-3.5 py-2.5 text-base placeholder:text-zinc-500 sm:py-2 sm:text-sm dark:border-zinc-700";
/** A bordered group of related content. */
export const panel = "rounded-2xl border border-zinc-200 bg-surface dark:border-zinc-800";
/** Headlines and big numbers. */
export const display = "font-display tracking-tight";
/** Secondary text. */
export const muted = "text-zinc-600 dark:text-zinc-400";
/** A toggle chip (filter, pick), on and off. Pair with `chip`. */
export const chip = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition active:scale-[0.96] sm:py-1";
export const chipOn = "border-foreground bg-foreground font-medium text-background";
export const chipOff = "border-zinc-300 bg-surface hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500";
/** A row of chips: scrolls sideways on phones, wraps on larger screens. */
export const chipRow = "scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0";
/** A small label that asks for attention: a food to use soon, a Pro feature. */
export const tag = "inline-block rounded-full bg-attention px-2.5 py-0.5 text-xs font-medium text-attention-ink";
/** An error the user can act on. */
export const alert = "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200";

/**
 * Colour tiles. Each means one thing across the app, so a colour is a signpost, not decoration:
 * plan = sky, shop = butter, scan = tangerine, cook = mint, use soon = sakura. Text on a tile is
 * the page's foreground in both schemes.
 */
export const tiles = {
  sky: "bg-tile-sky",
  butter: "bg-tile-butter",
  tangerine: "bg-tile-tangerine",
  mint: "bg-tile-mint",
  sakura: "bg-tile-sakura",
} as const;
export type Tile = keyof typeof tiles;
const TILE_CYCLE: Tile[] = ["sky", "butter", "mint", "sakura", "tangerine"];
/** A tile colour for the i-th card in a grid, so neighbours differ. */
export const tileFor = (i: number): Tile => TILE_CYCLE[i % TILE_CYCLE.length];
/** A card on a tile: rounded, no border, the tile colour behind it. */
export const tileCard = "rounded-2xl p-4";
