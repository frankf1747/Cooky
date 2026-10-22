// Owner: Platform. The shared look (AGENTS.md: one look; docs/BRAND.md for the why). Pages use
// these strings so type, buttons, fields, chips, tags and panels look and behave the same
// everywhere. Colours come from the tokens in app/globals.css; never pick one by hand. Controls
// are at least 44px tall on phones (a thumb in a shop or a kitchen) and text fields are 16px so
// iOS does not zoom.

// ---------------------------------------------------------------- type
/** The page title: Fraunces, big and tight. One per page. */
export const h1 = "font-display text-[2rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[2.75rem]";
/** A section title. */
export const h2 = "font-display text-[1.375rem] font-semibold leading-tight tracking-[-0.01em] sm:text-2xl";
/** A card or list-item title. */
export const h3 = "font-display text-lg font-semibold leading-snug tracking-[-0.005em]";
/** Headlines and big numbers that are not one of the above. */
export const display = "font-display tracking-[-0.015em]";
/** The small label above a title: where you are, or what this is. Sentence case. */
export const kicker = "text-[13px] font-medium leading-none text-muted";
/** Secondary text. */
export const muted = "text-muted";
/** Numbers that line up in columns. */
export const nums = "tabular-nums";

// ---------------------------------------------------------------- actions
const btn =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100";
/** The page's main action. One per screen, so it is always the thing to do next. */
export const btnPrimary = `${btn} h-12 px-6 text-[15px] bg-accent text-on-accent hover:bg-accent-hover sm:h-11`;
/** Any other action. */
export const btnSecondary = `${btn} h-12 px-6 text-[15px] border border-line-strong bg-surface text-foreground hover:border-foreground/45 hover:bg-sunken/50 sm:h-11`;
/** A secondary action inside a row or card (Edit, Used, Cancel), where a full-height button is too big. */
export const btnSecondarySm = `${btn} h-10 px-4 text-sm border border-line-strong bg-surface text-foreground hover:border-foreground/45 sm:h-9`;
/** A round button that holds one icon; give it an aria-label. */
export const btnIcon = `${btn} h-11 w-11 shrink-0 border border-line-strong bg-surface text-foreground hover:border-foreground/45`;
/** A small, text-only action next to content (a link or a quiet button). */
export const btnText = "font-medium text-accent underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:opacity-45";
/** A quiet link that should not compete with the content around it. */
export const linkQuiet = "text-muted underline-offset-4 transition hover:text-foreground hover:underline";

// ---------------------------------------------------------------- inputs
/** Text inputs, selects and textareas. */
export const field =
  "w-full min-w-0 rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-foreground placeholder:text-subtle transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60 sm:py-2.5 sm:text-[15px]";
/** A form label above its field. */
export const label = "flex flex-col gap-1.5 text-sm font-medium";
/** A toggle chip (filter, pick), on and off. Pair with `chip`. */
export const chip =
  "inline-flex h-11 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm transition duration-200 active:scale-[0.96] sm:h-9";
export const chipOn = "border-foreground bg-foreground font-medium text-background";
export const chipOff = "border-line-strong bg-surface text-foreground hover:border-foreground/50";
/** A row of chips: scrolls sideways on phones, wraps on larger screens. */
export const chipRow = "scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0";
/** A round check that pops when ticked; pair with a visually hidden checkbox. */
export const tick = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition duration-200";
export const tickOn = "tick-pop border-accent bg-accent text-on-accent";
export const tickOff = "border-line-strong bg-surface";

// ---------------------------------------------------------------- surfaces
/** A bordered group of related content. */
export const panel = "rounded-2xl border border-line bg-surface";
/** A quiet, borderless well: secondary content that sits behind the main thing. */
export const well = "rounded-2xl bg-sunken/70";
/** A list whose rows are separated by hairlines, inside a panel. */
export const rows = "divide-y divide-line rounded-2xl border border-line bg-surface";

// ---------------------------------------------------------------- labels and messages
const pill = "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";
/** A food to use soon, or a line that needs checking (a flagged receipt line, a missing item). */
export const tag = `${pill} bg-tomato-tint text-tomato-ink`;
/** A hard rule (a food you never eat). Ink, because it is a fact about you, not a warning. */
export const tagStrong = `${pill} bg-foreground text-background`;
/** A neutral fact (no date, a draft). */
export const tagNeutral = `${pill} bg-sunken text-muted`;
/** Something good and settled (saved, in stock, you have everything). */
export const tagGood = `${pill} bg-basil-tint text-basil-ink`;
/** Past its typical date. Amber is used for this and nothing else. */
export const tagPast = `${pill} bg-past text-past-ink`;
/** A Cooky Pro feature. */
export const tagPro = `${pill} bg-crust-tint text-crust-ink`;
/** An error the user can act on. */
export const alert = "rounded-2xl border border-danger/25 bg-danger-tint px-4 py-3 text-sm text-danger";
/** Something worked. */
export const notice = "rounded-2xl bg-basil-tint px-4 py-3 text-sm text-basil-ink";
/** A neutral heads-up. */
export const note = "rounded-2xl bg-sunken px-4 py-3 text-sm";
/** A past-its-date warning in a sentence. */
export const warn = "rounded-2xl bg-past px-4 py-3 text-sm text-past-ink";
/** A placeholder block while something loads. */
export const skeleton = "skeleton rounded-xl";

// ---------------------------------------------------------------- the week's colours
/**
 * Each step of the week has one colour, used as a quiet tint or a small dot, never to decorate:
 * plan = cobalt, shop = crust, scan = parchment, cook = basil, use soon = tomato. Text on a tint
 * uses its `ink` or the page's foreground, in both schemes.
 */
export const tones = {
  plan: { tint: "bg-cobalt-tint", ink: "text-cobalt-ink", dot: "bg-cobalt", label: "Plan" },
  shop: { tint: "bg-crust-tint", ink: "text-crust-ink", dot: "bg-crust", label: "Shop" },
  scan: { tint: "bg-parchment", ink: "text-parchment-ink", dot: "bg-parchment-ink", label: "Stock" },
  cook: { tint: "bg-basil-tint", ink: "text-basil-ink", dot: "bg-basil", label: "Cook" },
  soon: { tint: "bg-tomato-tint", ink: "text-tomato-ink", dot: "bg-tomato", label: "Use soon" },
} as const;
export type Tone = keyof typeof tones;
