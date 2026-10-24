# Cooky — brand and interface

> The look of Cooky, why it looks that way, and the rules a new screen follows. The living
> version is the page at `/brand`, drawn by the same components the app uses. Owner: Platform
> (AGENTS.md ownership table).
> Tokens live in `app/globals.css`, classes in `src/ui/styles.ts`, the frame in `src/ui/Page.tsx`,
> states in `src/ui/States.tsx`, Bao in `src/ui/Bao.tsx`, dish pictures in `src/ui/DishArt.tsx`.

## What we are making

Cooky should make people want to cook more often. Before cooking it makes them curious and
confident enough to start; during cooking it guides them; after, it lets them feel proud. Three
things carry that, and each has one job:

- **Food** makes people hungry. It leads every screen where a dish appears.
- **Bao**, a bun in a chef's hat, is the warmth. It shows up at moments that matter and stays
  out of the way the rest of the time.
- **The interface** is quiet: paper, ink, one action colour, generous space. It never competes
  with the food or with Bao.

Playful is not the same as busy. Every screen has **one focal point** and **one primary action**.

## The flow

The navigation follows the week, and every screen points at the next step:

**Recipes · Plan · Fridge · Stock · Cook.** The Fridge sits in the middle, raised, and is where a
signed-in person lands (`/home` only redirects there).

1. **Fridge.** A fridge whose doors swing open on arrival. Inside, plated dishes you can cook
   today ("everything's here", then "missing one or two things") and a crisper drawer of what
   you have. Tap a plate to put it in your plan. Below it, what's inside, to add and use up food.
2. **Recipes.** The library; the + on a card (or "Add to plan" on a recipe) does the same.
   Picks live in the browser (`src/ui/planPicks.ts`), show as a count on the Plan tab and a bar
   above the tab bar, and are sent as the plan's must-include dishes.
3. **Plan.** The basics, your picked dishes (take any out), and **Whatever's good** to let Bao
   choose every dinner within the budget and time. The result lists the dinners in cooking order,
   then two big buttons: **Step 2 · Shop** (the list, with its count and price) and
   **Step 3 · Stock** (scan the receipt; prices get logged and the food goes in). One floating
   **Cook** button cooks the whole plan.
4. **Cook.** The tab shows this week's plan in order with one Start; cook mode says
   "Dish 1 of 3" and offers the next dish once one is confirmed.

## Bao

A toasted bun with a flat base, a toque that leans 6° to the left with a cobalt band, three
sesame seeds on the left shoulder, and a small face set low. Two flat tones (lit dough and crust
shadow), no outline, no gradient, no blush. Recognisable in silhouette alone (see `/brand`).

| State | Use it when | Example |
|---|---|---|
| welcoming | Hello, sign-in, a fresh start, a plain tip | Onboarding, empty plan |
| curious | Watching, listening, waiting for input | Login, scan a receipt |
| thinking | Waiting on the planner or the receipt reader | Plan form while planning |
| encouraging | Food to use soon; "you can do this" | Home focus card |
| confused | Errors, nothing found, a missing recipe | Every `error.tsx`, 404 |
| celebrating | A meal confirmed, a full cart, Pro unlocked | Cook done, shop list done |
| reassuring | Before a confirm; "nothing changed" | Cook confirm screen |
| resting | Nothing urgent | Empty fridge |

Poses: `rest`, `wave`, `cheer`, `think`, `hold` (with a prop: `spoon` cook, `basket` shop,
`receipt` scan, `timer`), `cover` (eyes covered while a password is typed). Hands are small
mittens with no arms.

Rules:

- **One Bao in view.** Never in a list, a card grid or a recipe placeholder.
- Bao **reacts** to what the person just did (mood, pose, a one-shot `hop` or `nod`). It never
  blocks an action or hides information.
- Every empty state, wait and milestone is one line from Bao (`BaoSays`, or `EmptyState`,
  which includes Bao). On a screen where Bao already appears, a secondary empty list gets the
  line as plain text in a quiet well, so there is still only one Bao.
- A thread of answers in cook mode is a list: replies are bubbles labelled "Bao", not drawings. The line is specific, warm, a little dry; never cute for its own sake,
  never two exclamation marks, no emoji.
- Motion: `breathe` only on a hero-sized Bao that is waiting with you; `hop` once for a real
  accomplishment; `nod` once to acknowledge. All motion stops under reduced motion.

## Colour

Paper and ink carry every page. Colour is a signpost, never decoration.

| Token | Means |
|---|---|
| `background`, `surface`, `sunken` | Paper: the page, raised things, wells and skeletons |
| `foreground`, `muted`, `subtle` | Ink: text, secondary text, meta text |
| `line`, `line-strong` | Hairlines and field borders |
| `accent` (cobalt) | **Actions, and only actions** |
| `cobalt-tint` | Plan |
| `crust-tint` | Shop, and Cooky Pro |
| `parchment` | Stock (the receipt scan), and the table under illustrated food |
| `basil-tint` / `basil` | Cook; done; good |
| `tomato-tint` / `tomato` | Use soon; also a line that needs checking (a flagged receipt line, a missing item) |
| `past` (amber) | Past its typical date, and nothing else |
| `danger` | Errors |
| `cobalt-deep` + `on-brand` | The brand moments: the fridge, the raised Fridge tab, sign-in, the landing page |
| `paper` + `on-paper` | A sheet of paper on the cobalt ground (the note on the fridge door, Bao's sign-in bubble); paper in both schemes |

Both schemes share these names. Which one is in force is `<html data-theme>`: Settings →
Appearance offers System (follow the device), Light and Dark, saved on the device and applied
before the first paint (`src/ui/theme.ts`). Use the `dark:` variant only for art that has no
token, never for a colour a token could carry.

The only fixed hex colours live in the art: Bao (`src/ui/Bao.tsx`), the dish illustrations
(`src/ui/DishArt.tsx`) and the app icon. Food and the character look the same at night.

The week's colours are exposed as `tones.plan | shop | scan | cook | soon` with a `tint`, an
`ink` and a `dot`. Use a tint for at most one ground per screen (the focal card); elsewhere use
the dot in a `Kicker`. Never cycle colours through a grid.

## Type

- **Fraunces** (soft, `SOFT 100`) for headlines, big numbers and step text in cook mode:
  `h1` page titles (32 → 44px), `h2` sections (22 → 24px), `h3` card titles (18px).
- **Geist** for everything you read or tap: 16px body on phones, 15px secondary, 13px meta.
- Sentence case everywhere. The small label above a title is a `Kicker`, not all-caps.
- Numbers that line up use `tabular-nums`.

## Shape, space, elevation, motion

- Pill buttons and chips; 16px cards (`panel`, `rows`); 24–28px feature panels; food in the
  `shape-dome` (the top of a bun); `shape-dough` behind illustrations; `receipt-edge` only for
  receipts.
- Pages sit in `Page` at 2xl / 4xl / 6xl widths with 16px gutters on phones. Sections are 48–56px
  apart. Controls are at least 44px tall on phones; the main action is full width there.
- One warm shadow, `shadow-float`, for things that float (menus, sticky bars, speech bubbles).
  Cards are flat with a hairline.
- Motion classes: `rise-in`, `pop-in`, `tick-pop`, `skeleton`, and Bao's `bun-*`. Small,
  physical, 200–400ms, ease-out.

## Components

From `src/ui/styles.ts`: `btnPrimary`, `btnSecondary`, `btnSecondarySm`, `btnIcon`, `btnText`,
`linkQuiet`, `field`, `label`, `chip` + `chipOn`/`chipOff`, `chipRow`, `tick` + `tickOn`/`tickOff`,
`panel`, `well`, `rows`, `tag`, `tagNeutral`, `tagGood`, `tagPast`, `tagPro`, `tagStrong`,
`alert`, `notice`, `note`, `warn`, `skeleton`, `h1`/`h2`/`h3`, `kicker`, `tones`.

From `src/ui/Page.tsx`: `Page` (kicker, tone, title, one-line description, actions, back),
`Section`, `Kicker`, `BackLink`, `EmptyState`. Two screens keep `Page`'s container but draw their
own top: recipe detail (a food hero beside the title) and cook mode (a focus header with step
progress and no app navigation). From `src/ui/States.tsx`: `ErrorState` and
`PageSkeleton` — every route's `error.tsx` and `loading.tsx` is one line around these.

## Food pictures

Until dish photography is chosen, `DishArt` draws each recipe as a top-down still life
from its title: a blue-rimmed enamel plate, a bowl or a cast-iron skillet on parchment, with the
dish's own ingredients. It is deterministic per recipe id. When a recipe has `imageUrl`,
`RecipeImage` shows the photo in the same dome, so photography drops in without layout changes.

## Before you ship a screen

1. Is there exactly one focal point, and is the primary action obvious within a second?
2. If food appears, does it lead?
3. Is Bao here for a reason (empty, waiting, a milestone), and only once?
4. Is every colour a token, and does each colour mean what this page says it means?
5. Loading, empty, error and retry states exist, and retry is disabled while it runs.
6. At 375px: nothing wider than the screen, controls 44px, main action full width.
7. Dark mode reads well, and reduced motion stops everything.
