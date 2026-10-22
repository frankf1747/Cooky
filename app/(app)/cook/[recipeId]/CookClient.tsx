"use client";
// Owner: Recipes & Cook. Cook mode, a focused screen with nothing else on it:
//   cook (CK1, ASK1–ASK5): one step at a time in large type with its timer and prep tip, progress
//       across the top, Back and Next in a bar under the thumb (arrow keys work too), one-tap
//       questions and free questions answered from the recipe, with their sources.
//   confirm & learn (CK2–CK3, LRN): what you used (oldest pack first), leftovers, rating and a
//       note; preference suggestions to keep always, once, or not at all. Bao celebrates once.
//   a plan in order: opened from a plan's Cook button, the screen says which dish of how many,
//       and confirming one offers the next.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CaretDown, Minus, PaperPlaneRight, Plus, X } from "@phosphor-icons/react";
import type { Chunk, CookAnswer, Recipe } from "@spec/contract";
import { Bao, BaoSays, type BaoMood, type BaoMotion } from "@/ui/Bao";
import { Kicker } from "@/ui/Page";
import { alert, btnIcon, btnPrimary as btn, btnSecondary as btnGhost, btnText, chip, chipOff, chipRow, field as input, h1, h2, muted, panel as card, rows, warn } from "@/ui/styles";
import { cookErrorMessage, formatQty, formatTimer, scaled, type ApiErrorBody } from "../../recipes/ui";

type Limits = { servingsMin: number; servingsMax: number; questionMaxChars: number; feedbackMaxChars: number };
type Failure = ReturnType<typeof cookErrorMessage>;
type Deduction = { itemId: string; ingredientId: string; qty: number; unit: string; shortBy: number | null };
type DoneResult = {
  cookEventId: string;
  deductions: Deduction[];
  missing?: { ingredientId: string; qty: number; unit: string }[];
  leftovers: { servings: number; expiresOn: string };
};
type Proposal = { id: string; value: string; reason: string };
/** A plan's dinners in cooking order, and which one this is. */
export type CookSequence = { planId: string; index: number; dishes: { recipeId: string; title: string }[] };
type ProposalState = "open" | "saving" | "always" | "once" | "dismiss" | "error";

const SAFETY_URL = "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures";
/** One-tap questions; the current step is added so retrieval finds it. */
const QUICK = ["Is it done?", "It's sticking", "Short on time", "Keep it juicy"] as const;


async function post<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; failure: Failure }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as T } : { ok: false, failure: cookErrorMessage(res.status, json as ApiErrorBody) };
  } catch {
    return { ok: false, failure: { message: "You seem to be offline. Nothing was changed; try again when you're connected.", retry: true } };
  }
}


function ErrorNote({ failure, onRetry, busy }: { failure: Failure; onRetry?: () => void; busy: boolean }) {
  return (
    <div role="alert" className={`mt-3 ${alert}`}>
      <p>{failure.message}</p>
      <div className="mt-2 flex gap-4">
        {failure.retry && onRetry && (
          <button onClick={onRetry} disabled={busy} className={btnText}>Try again</button>
        )}
        {failure.upgrade && <Link className={btnText} href="/billing">Unlock Pro</Link>}
      </div>
    </div>
  );
}

function Timer({ seconds, onDone }: { seconds: number; onDone?: () => void }) {
  const [total, setTotal] = useState(seconds);
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!running || left <= 0) return;
    const t = setTimeout(() => {
      setLeft((s) => s - 1);
      if (left === 1) doneRef.current?.();
    }, 1000);
    return () => clearTimeout(t);
  }, [running, left]);
  const pct = total ? ((total - left) / total) * 100 : 0;
  return (
    <div className={`mt-7 flex flex-wrap items-center gap-x-5 gap-y-4 p-4 sm:p-5 ${card}`}>
      <div
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(var(--basil) ${pct}%, var(--sunken) 0)` }}
        aria-hidden
      >
        <span className="flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full bg-surface font-display text-2xl font-semibold tabular-nums">{left === 0 ? "0:00" : formatTimer(left)}</span>
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-[15px] font-medium" aria-live="polite">{left === 0 ? "Time's up. On to the next bit." : running ? `Running, of ${formatTimer(total)}` : `A ${formatTimer(total)} timer`}</p>
        {!running && left !== 0 && <p className={`mt-0.5 text-sm ${muted}`}>Start it when the step begins.</p>}
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          onClick={() => {
            if (left === 0) {
              setLeft(total);
              setRunning(true);
            } else setRunning((r) => !r);
          }}
          className={`flex-1 sm:flex-none ${btn}`}
        >
          {running ? "Pause" : left === 0 ? "Restart" : "Start timer"}
        </button>
        <button
          onClick={() => {
            setTotal((t) => t + 60);
            setLeft((s) => s + 60);
          }}
          className={btnGhost}
        >
          +1 min
        </button>
      </div>
    </div>
  );
}

export function CookClient({ recipe, pro, defaultServings, limits, sequence = null }: { recipe: Recipe; pro: boolean; defaultServings: number; limits: Limits; sequence?: CookSequence | null }) {
  const next = sequence ? sequence.dishes[sequence.index + 1] : undefined;
  const nextHref = sequence && next ? `/cook/${next.recipeId}?plan=${sequence.planId}&n=${sequence.index + 1}` : null;
  const dishOf = sequence ? `Dish ${sequence.index + 1} of ${sequence.dishes.length}` : null;
  const [servings, setServings] = useState(defaultServings);
  const steps = recipe.steps.filter((s) => s.kind === "step");
  const tips = new Map(recipe.steps.filter((s) => s.kind === "tip").map((t) => [t.stepNo, t]));
  const [index, setIndex] = useState(0);
  const step: Chunk | undefined = steps[index];
  const names = new Map(recipe.ingredients.map((i) => [i.ingredientId, i.name]));
  const chunkById = new Map([...recipe.steps, ...recipe.faqs].map((c) => [c.id, c]));
  const minutesLeft = Math.max(1, Math.round((recipe.minutes * (steps.length - index)) / Math.max(1, steps.length)));
  const last = index === steps.length - 1;

  // ---- coach (ASK)
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  // The chat is per step: each question remembers the step it was asked on.
  const [thread, setThread] = useState<{ q: string; a: CookAnswer; stepId: string | null }[]>([]);
  const [asking, setAsking] = useState(false);
  const [askFailure, setAskFailure] = useState<Failure | null>(null);
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const lastQuestion = useRef({ text: "", shown: "" });

  /** `shown` is what the chat displays; `text` may carry extra context for retrieval. */
  async function ask(text: string, shown = text) {
    if (!text.trim() || asking) return;
    lastQuestion.current = { text, shown };
    setAsking(true);
    setAskFailure(null);
    const res = await post<CookAnswer>(`/api/cook/${recipe.id}/ask`, { question: text, ...(sessionId ? { sessionId } : {}) });
    setAsking(false);
    if (!res.ok) return setAskFailure(res.failure);
    setSessionId(res.data.sessionId);
    setThread((t) => [...t, { q: shown, a: res.data, stepId: step?.id ?? null }]);
    setQuestion("");
  }
  const askQuick = (q: string) => ask(step?.stepNo ? `${q} (I'm on step ${step.stepNo})` : q, q);

  // ---- done and confirm (CK2–CK3)
  const [done, setDone] = useState<DoneResult | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [leftovers, setLeftovers] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneFailure, setDoneFailure] = useState<Failure | null>(null);
  const [confirmed, setConfirmed] = useState<{ proposals: Proposal[] } | null>(null);
  const [choices, setChoices] = useState<Record<string, ProposalState>>({});
  const [leftoverDays, setLeftoverDays] = useState(0);
  const [timerDone, setTimerDone] = useState(false);

  const goTo = (next: number) => {
    setTimerDone(false);
    setIndex(next);
  };

  // Arrow keys move between steps, unless you are typing.
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      // Leave browser shortcuts (Alt/Cmd + arrow is Back) and held keys alone.
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const next = e.key === "ArrowRight" ? index + 1 : e.key === "ArrowLeft" ? index - 1 : -1;
      if (next < 0 || next >= steps.length) return;
      setTimerDone(false);
      setIndex(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, index, steps.length]);

  // One row per ingredient (design frame 9); its items are the proposal's, oldest pack first.
  const groups = done
    ? [...new Set(done.deductions.map((d) => d.ingredientId))].map((ingredientId) => {
        const items = done.deductions.filter((d) => d.ingredientId === ingredientId);
        return { ingredientId, unit: items[0].unit, items, shortBy: items.find((d) => d.shortBy !== null)?.shortBy ?? null };
      })
    : [];

  async function finish() {
    if (busy) return;
    setBusy(true);
    setDoneFailure(null);
    const res = await post<DoneResult>(`/api/cook/${recipe.id}/done`, { servings });
    setBusy(false);
    if (!res.ok) return setDoneFailure(res.failure);
    setDone(res.data);
    const totals: Record<string, number> = {};
    for (const d of res.data.deductions) totals[d.ingredientId] = (totals[d.ingredientId] ?? 0) + d.qty;
    setAmounts(Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, String(Math.round(v * 100) / 100)])));
    setLeftovers(res.data.leftovers.servings);
    setLeftoverDays(Math.max(0, Math.ceil((Date.parse(`${res.data.leftovers.expiresOn}T00:00:00Z`) - Date.now()) / 86_400_000)));
  }

  const badAmount = groups.some((g) => amounts[g.ingredientId] === "" || !(Number(amounts[g.ingredientId]) >= 0));

  /** Spread the amount typed for an ingredient over its packs, oldest first; any extra lands on the last one. */
  function perItem(): { itemId: string; qty: number }[] {
    return groups.flatMap((g) => {
      let left = Number(amounts[g.ingredientId]);
      return g.items.map((d, i) => {
        const qty = i === g.items.length - 1 ? left : Math.min(d.qty, left);
        left -= qty;
        return { itemId: d.itemId, qty: Math.max(0, Math.round(qty * 1000) / 1000) };
      });
    });
  }

  async function confirm() {
    if (!done || busy || badAmount) return;
    setBusy(true);
    setDoneFailure(null);
    const res = await post<{ proposals: Proposal[] }>(`/api/cook/events/${done.cookEventId}/confirm`, {
      deductions: perItem(),
      leftoverServings: leftovers,
      ...(rating ? { rating } : {}),
      ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
    });
    setBusy(false);
    if (!res.ok) return setDoneFailure(res.failure);
    setConfirmed({ proposals: res.data.proposals ?? [] });
  }

  async function choose(p: Proposal, scope: "always" | "once" | "dismiss") {
    setChoices((c) => ({ ...c, [p.id]: "saving" }));
    const res = await post<{ preferenceId: string | null }>("/api/preferences", { proposalId: p.id, scope });
    setChoices((c) => ({ ...c, [p.id]: res.ok ? scope : "error" }));
  }

  // ---------------------------------------------------------------- confirm & learn
  if (done) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <Kicker tone="cook">{dishOf ? `${dishOf} · ${recipe.title}` : recipe.title}</Kicker>
        <h1 className={`${h1} mt-3`}>{confirmed ? (sequence && !next ? "That's the whole plan" : "Logged. Nice cooking.") : "Dinner's done"}</h1>
        <BaoSays
          key={confirmed ? "confirmed" : "done"}
          mood={confirmed ? "celebrating" : "reassuring"}
          pose={confirmed ? "cheer" : "hold"}
          prop={confirmed ? "none" : "spoon"}
          motion={confirmed ? "hop" : "nod"}
          size={96}
          className="mt-6"
        >
          {confirmed
            ? sequence && !next ? `${recipe.title}, done, and that's every dinner in the plan. The fridge knows.` : `${recipe.title}, done. The fridge knows.`
            : "Check what you used. The fridge only changes when you confirm, so take your time."}
        </BaoSays>

        {!confirmed && (
          <>
            <h2 className={`${h2} mt-10`}>What you used</h2>
            <ul className={`mt-4 ${rows}`}>
              {groups.map((g) => (
                <li key={g.ingredientId} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium">{names.get(g.ingredientId) ?? g.ingredientId}</p>
                    <p className={`text-sm ${muted}`}>
                      {g.items.length > 1 ? `Older pack first · ${g.items.map((d) => formatQty(d.qty, d.unit)).join(" + ")}` : "From your fridge"}
                      {g.shortBy !== null && <span className="text-tomato-ink"> · fridge is {formatQty(g.shortBy, g.unit)} short</span>}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="number" min={0} step="any" inputMode="decimal"
                      aria-label={`Amount of ${names.get(g.ingredientId) ?? g.ingredientId} used`}
                      value={amounts[g.ingredientId] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [g.ingredientId]: e.target.value }))}
                      className={`!w-24 text-right tabular-nums ${input}`}
                    />
                    <span className={`w-8 text-sm ${muted}`}>{g.unit === "count" ? "" : g.unit}</span>
                  </label>
                </li>
              ))}
              {(done.missing ?? []).map((m) => (
                <li key={m.ingredientId} className="px-4 py-3.5">
                  <p className="font-medium">{names.get(m.ingredientId) ?? m.ingredientId}</p>
                  <p className={`text-sm ${muted}`}>Not in your fridge, so nothing to take off</p>
                </li>
              ))}
              {groups.length === 0 && (done.missing ?? []).length === 0 && <li className={`px-4 py-3.5 ${muted}`}>Nothing from your fridge to take off.</li>}
            </ul>

            <div className={`mt-4 flex items-center justify-between gap-4 px-4 py-3.5 ${card}`}>
              <div className="min-w-0">
                <p className="font-medium">Save leftovers</p>
                <p className={`text-sm ${muted}`}>Goes in the fridge as a dish · keeps about {leftoverDays} days (typical guide, USDA FoodKeeper)</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button aria-label="One fewer leftover serving" onClick={() => setLeftovers((n) => Math.max(0, n - 1))} className={btnIcon}><Minus size={16} weight="bold" aria-hidden /></button>
                <span className="w-6 text-center font-display text-xl font-semibold tabular-nums" aria-live="polite">{leftovers}</span>
                <button aria-label="One more leftover serving" onClick={() => setLeftovers((n) => Math.min(limits.servingsMax, n + 1))} className={btnIcon}><Plus size={16} weight="bold" aria-hidden /></button>
              </div>
            </div>

            <div className={`mt-4 px-4 py-4 ${card}`}>
              <p className="font-medium">How was it?</p>
              <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Rating out of 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n} role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`}
                    onClick={() => setRating(rating === n ? null : n)}
                    className={`h-11 w-11 rounded-full border font-display text-lg font-semibold transition active:scale-[0.94] ${rating !== null && n <= rating ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface hover:border-foreground/45"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <textarea
                value={feedback} maxLength={limits.feedbackMaxChars} onChange={(e) => setFeedback(e.target.value)} rows={2}
                placeholder="Tasty, but a bit dry" aria-label="A note for next time"
                className={`mt-4 ${input}`}
              />
              {pro && <p className={`mt-2 text-sm ${muted}`}>Cooky may suggest a preference from your note. Nothing is saved unless you choose it.</p>}
            </div>

            {badAmount && <p className={`mt-4 ${alert}`}>Each amount must be a number of 0 or more.</p>}
            <button onClick={confirm} disabled={busy || badAmount} className={`mt-8 w-full ${btn}`}>
              {busy ? "Updating your fridge…" : "Confirm and update fridge"}
            </button>
            <button
              onClick={() => {
                setDone(null);
                setDoneFailure(null);
              }}
              disabled={busy}
              className={`mt-4 w-full text-[15px] ${btnText}`}
            >
              Back to the steps
            </button>
            {doneFailure && <ErrorNote failure={doneFailure} onRetry={confirm} busy={busy} />}
          </>
        )}

        {confirmed && (
          <>
            {leftovers > 0 && <p className="mt-6 text-[15px]">{leftovers} leftover serving{leftovers > 1 ? "s" : ""} added to your fridge.</p>}
            {confirmed.proposals.map((p) => (
              <div key={p.id} className={`mt-5 p-5 ${card}`}>
                <p className={`text-sm ${muted}`}>Remember this for next time?</p>
                <p className="mt-1 font-display text-xl font-semibold">{p.value}</p>
                <p className={`mt-0.5 text-sm ${muted}`}>{p.reason}</p>
                {choices[p.id] === "always" || choices[p.id] === "once" || choices[p.id] === "dismiss" ? (
                  <p className="mt-3 text-[15px]">{choices[p.id] === "always" ? "Saved. Your next plans will use it." : choices[p.id] === "once" ? "Used for your next plan only." : "Not saved."}</p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => choose(p, "always")} disabled={choices[p.id] === "saving"} className={btn}>Always</button>
                    <button onClick={() => choose(p, "once")} disabled={choices[p.id] === "saving"} className={btnGhost}>Just this time</button>
                    <button onClick={() => choose(p, "dismiss")} disabled={choices[p.id] === "saving"} className={btnGhost}>Don&apos;t save</button>
                  </div>
                )}
                {choices[p.id] === "error" && <p className={`mt-3 ${alert}`}>That didn&apos;t save. You can set it later on the Preferences page.</p>}
              </div>
            ))}
            {nextHref && next ? (
              <div className="mt-8 grid gap-3 sm:flex">
                <Link className={btn} href={nextHref}>Next dish: {next.title}</Link>
                <Link className={btnGhost} href="/fridge">Done for tonight</Link>
              </div>
            ) : (
              <div className="mt-8 grid gap-3 sm:flex">
                <Link className={btn} href="/fridge">See your fridge</Link>
                <Link className={btnGhost} href={sequence ? `/plan/${sequence.planId}` : "/recipes"}>{sequence ? "Back to the plan" : "Cook something else"}</Link>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------- cook
  const tip = step ? tips.get(step.stepNo) : undefined;
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-36 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 bg-background/90 px-4 pb-3 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-3">
          <Link href={sequence ? `/plan/${sequence.planId}` : `/recipes/${recipe.id}`} aria-label={sequence ? "Leave cook mode, back to the plan" : "Leave cook mode, back to the recipe"} className={btnIcon}>
            <X size={18} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{recipe.title}</p>
            <p className={`text-sm ${muted}`}>
              {dishOf && <>{dishOf} · </>}
              {steps.length > 0 ? <>Step {index + 1} of {steps.length} · about {minutesLeft} min to go</> : <>About {recipe.minutes} min</>}
            </p>
          </div>
          <button onClick={finish} disabled={busy} className={`shrink-0 text-[15px] ${btnText}`}>Finish</button>
        </div>
        {steps.length > 0 && (
          <div className="mt-3 flex gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.id} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= index ? "bg-basil" : "bg-sunken"}`} />
            ))}
          </div>
        )}
      </header>

      <details className={`group mt-3 px-4 ${card}`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex-1">
            Ingredients for{" "}
            <select value={servings} onChange={(e) => setServings(Number(e.target.value))} onClick={(e) => e.stopPropagation()} aria-label="Servings" className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-base sm:text-[15px]">
              {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </span>
          <CaretDown size={16} aria-hidden className="text-muted transition group-open:rotate-180" />
        </summary>
        <ul className="grid gap-x-8 border-t border-line py-3 text-[15px] sm:grid-cols-2">
          {recipe.ingredients.map((i) => (
            <li key={i.ingredientId} className="flex justify-between gap-3 py-1">
              <span>{i.name}{i.optional && <span className={`ml-1 text-sm ${muted}`}>(optional)</span>}</span>
              <span className="tabular-nums">{formatQty(scaled(i.qty, recipe.baseServings, servings), i.unit)}</span>
            </li>
          ))}
        </ul>
      </details>

      {step ? (
        <article key={step.id} className="rise-in mt-10 sm:mt-14">
          <Kicker tone="cook">Step {step.stepNo}</Kicker>
          <p className="mt-4 font-display text-[1.625rem] font-medium leading-[1.28] tracking-[-0.01em] sm:text-[2rem]">{step.text}</p>
          {step.timerSeconds && <Timer key={step.id} seconds={step.timerSeconds} onDone={() => setTimerDone(true)} />}
        </article>
      ) : (
        <BaoSays mood="confused" className="mt-10">This recipe has no steps yet. Even I can&apos;t cook from nothing.</BaoSays>
      )}

      {nextHref && next && (
        <p className="mt-8 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
          <span>Up next in your plan: <span className="font-medium text-foreground">{next.title}</span></span>
          <Link href={nextHref} className={btnText}>Skip to it</Link>
        </p>
      )}

      {/* The chat with Bao for this step. Bao opens it (the step's tip, or a line for where you
          are), answers questions with their sources, and says when a timer ends. Its avatar sits
          on its newest message and reacts: thinking while it reads, puzzled when the recipe
          doesn't cover something, pleased when it can help. Questions are Cooky Pro; the rest is
          for everyone. */}
      {step && (
        <section aria-label="Chat with Bao" className="mt-10">
          <div className="space-y-3" aria-live="polite">
            {(() => {
              const here = thread.map((t, i) => ({ ...t, i })).filter((t) => t.stepId === step.id);
              const lastAnswer = here[here.length - 1];
              // Whichever Bao message is newest gets the avatar; the others line up under it.
              const latest = timerDone ? "timer" : asking ? "asking" : lastAnswer ? `a${lastAnswer.i}` : "opener";
              const opener = tip
                ? <><span className="font-semibold">Tip. </span>{tip.text}</>
                : index === 0
                  ? <>Let&apos;s cook. Read the step through once, then go.</>
                  : last
                    ? <>Last step. Nearly there.</>
                    : <>Step {index + 1} of {steps.length}. Shout if anything looks off.</>;
              return (
                <>
                  <BaoMessage avatar={latest === "opener"} mood={tip || index === 0 ? "welcoming" : "encouraging"} motion="nod" avatarKey={`open-${step.id}`}>
                    {opener}
                    {pro && <span className={`mt-1 block text-sm ${muted}`}>Ask me anything about this step.</span>}
                  </BaoMessage>
                  {here.map(({ q, a, i }) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-end">
                        <p className="pop-in max-w-[80%] rounded-[20px] rounded-br-md bg-accent-soft px-4 py-2.5 text-[15px]">{q}</p>
                      </div>
                      <BaoMessage
                        avatar={latest === `a${i}`}
                        mood={a.notCovered ? "confused" : a.safetyTopic ? "reassuring" : "encouraging"}
                        motion="nod"
                        avatarKey={`a${i}`}
                        unsure={a.notCovered}
                      >
                        <p>{a.answer}</p>
                        {a.notCovered && <p className={`mt-1 text-sm ${muted}`}>I only answer from this recipe, so I won&apos;t guess. Try saying it another way, or tap a question below.</p>}
                        {a.citations.length > 0 && (
                          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className={muted}>From:</span>
                            {a.citations.map((c) => (
                              <button
                                key={c.chunkId}
                                onClick={() => setOpenCitation(openCitation === `${i}:${c.chunkId}` ? null : `${i}:${c.chunkId}`)}
                                aria-expanded={openCitation === `${i}:${c.chunkId}`}
                                className="rounded-full border border-line-strong bg-surface px-2.5 py-1 transition hover:border-foreground/45"
                              >
                                {c.kind === "tip" ? `Tip, step ${chunkById.get(c.chunkId)?.stepNo ?? ""}` : c.label.replace(/^FAQ:\s*/, "FAQ · ")}
                              </button>
                            ))}
                          </p>
                        )}
                        {a.citations.map((c) =>
                          openCitation === `${i}:${c.chunkId}` ? (
                            <blockquote key={c.chunkId} className={`mt-2 border-l-2 border-line-strong pl-3 text-sm ${muted}`}>
                              {chunkById.get(c.chunkId)?.text ?? "This part of the recipe is no longer available."}
                            </blockquote>
                          ) : null,
                        )}
                        {a.safetyTopic && (
                          <p className={`mt-3 !py-2 text-sm ${warn}`}>
                            For doneness, spoilage and allergens, follow the official guidance on <a className="underline" href={SAFETY_URL} target="_blank" rel="noopener noreferrer">FoodSafety.gov</a>.
                          </p>
                        )}
                      </BaoMessage>
                    </div>
                  ))}
                  {asking && (
                    <BaoMessage avatar={latest === "asking"} mood="thinking" motion="breathe" avatarKey="asking">
                      <span role="status" className={muted}>Reading the recipe. Give me a second.</span>
                    </BaoMessage>
                  )}
                  {timerDone && (
                    <BaoMessage avatar mood="celebrating" motion="hop" avatarKey={`timer-${step.id}`}>
                      <span role="status">Ding. Time&apos;s up on step {step.stepNo}. On to the next bit.</span>
                    </BaoMessage>
                  )}
                </>
              );
            })()}
            {askFailure && <ErrorNote failure={askFailure} onRetry={() => ask(lastQuestion.current.text, lastQuestion.current.shown)} busy={asking} />}
          </div>

          {pro ? (
            <div className="mt-4 pl-[3.375rem]">
              {!asking && (
                <div className={`${chipRow} !mx-0 !px-0`} aria-label="Quick questions">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => askQuick(q)} className={`${chip} ${chipOff} !h-10 sm:!h-9`}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(question);
                }}
                className="mt-3 flex items-center gap-2"
              >
                <input
                  value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={limits.questionMaxChars}
                  placeholder="Ask Bao about this step" aria-label="Your question for Bao"
                  className={`min-w-0 flex-1 !rounded-full ${input}`}
                />
                <button disabled={asking || !question.trim()} aria-label="Send your question" className={`${btnIcon} !border-transparent !bg-accent !text-on-accent disabled:!bg-sunken disabled:!text-subtle`}>
                  <PaperPlaneRight size={18} weight="fill" aria-hidden />
                </button>
              </form>
            </div>
          ) : (
            <p className="mt-4 pl-[3.375rem] text-sm text-muted">
              Questions while you cook come with Cooky Pro. <Link className={btnText} href="/billing">Unlock Pro</Link>
            </p>
          )}
        </section>
      )}

      {/* Back and Next live under the thumb; on the last step, Next becomes "done". A failed
          finish shows here too, where the person tapped, not at the end of a long page. */}
      <nav aria-label="Steps" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        {doneFailure && (
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <ErrorNote failure={doneFailure} onRetry={finish} busy={busy} />
          </div>
        )}
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3 sm:px-6">
          {steps.length > 0 && (
            <button onClick={() => goTo(index - 1)} disabled={index === 0} className={`${btnGhost} !px-5`} aria-label="Previous step">
              <ArrowLeft size={18} aria-hidden />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          {steps.length > 0 && !last ? (
            <button onClick={() => goTo(index + 1)} className={`flex-1 ${btn}`}>
              Next step
              <ArrowRight size={18} aria-hidden />
            </button>
          ) : (
            <button onClick={finish} disabled={busy} className={`flex-1 ${btn}`}>
              {busy ? "Checking your fridge…" : "I'm done cooking"}
            </button>
          )}
        </div>
      </nav>
    </section>
  );
}

/**
 * One message from Bao in the cooking chat. Only the newest Bao message carries the drawing (so
 * one Bao is in view and it "moves" down the conversation, reacting as it goes); the others keep
 * its space so the bubbles line up. The avatar is keyed so its motion plays once per message.
 */
function BaoMessage({ children, avatar, mood, motion, avatarKey, unsure = false }: { children: ReactNode; avatar: boolean; mood: BaoMood; motion: BaoMotion; avatarKey: string; unsure?: boolean }) {
  return (
    <div className="flex items-end gap-2.5">
      <span aria-hidden className="w-11 shrink-0">
        {avatar && <Bao key={avatarKey} mood={mood} motion={motion} size={44} ground={false} decorative />}
      </span>
      <div className={`min-w-0 max-w-[85%] rounded-[20px] rounded-bl-md border px-4 py-3 text-[15px] leading-relaxed ${unsure ? "border-line-strong bg-sunken/60" : "border-line bg-surface"}`}>
        <span className="sr-only">Bao: </span>
        {children}
      </div>
    </div>
  );
}
