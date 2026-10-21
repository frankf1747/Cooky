"use client";
// Owner: Recipes & Cook. Cook mode, following design frames 8 and 9 in Cooky's sky-blue and
// sakura look:
//   8 · cook with Bao (CK1, ASK1–ASK5): one step at a time with its timer, the step's prep tip,
//       one-tap questions and free questions answered from the recipe, with their sources.
//   9 · confirm & learn (CK2–CK3, LRN): what you used (oldest pack first), leftovers, rating and a
//       note; preference suggestions to keep always, once, or not at all.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Chunk, CookAnswer, Recipe } from "@spec/contract";
import { maru } from "../../recipes/font";
import { Confetti, FunStyles, Sakura, Steam, ThinkingDots, Washi, dishEmoji, stepCheer, ui } from "../../recipes/fun";
import { Mascot, type Mood } from "../../recipes/Mascot";
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
type ProposalState = "open" | "saving" | "always" | "once" | "dismiss" | "error";

const SAFETY_URL = "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures";
/** One-tap questions from the design; the current step is added so retrieval finds it. */
const QUICK = [
  ["🔍", "Is it done?"],
  ["🍳", "It's sticking"],
  ["⏰", "Short on time"],
  ["💧", "Keep it juicy"],
] as const;
const RATING_WORDS = ["", "Oh no, we'll do better next time 🥲", "Not quite, noted 📝", "Pretty good! 🙂", "Yum! 😋", "Chef's kiss! 🤌"];

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
    <div role="alert" className={`mt-3 flex items-start gap-3 border-2 border-[#E58AA0] bg-[#FFF0F3] p-3 text-sm ${ui.wobbleSm}`}>
      <Mascot mood="worried" size={40} className="shrink-0" />
      <div>
        <p>{failure.message}</p>
        <div className="mt-2 flex gap-3">
          {failure.retry && onRetry && (
            <button onClick={onRetry} disabled={busy} className={`${ui.link} disabled:opacity-50`}>Try again</button>
          )}
          {failure.upgrade && <Link className={ui.link} href="/billing">Unlock Pro</Link>}
        </div>
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
  const pct = total ? (total - left) / total : 0;
  return (
    <div className={`mt-4 flex items-center gap-4 border-2 border-dashed border-[#A8D8EA] bg-[#F3FAFD] p-3 ${ui.wobbleSm}`}>
      <div
        className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-2 border-[#34374A]"
        style={{ background: `conic-gradient(#FFB7C5 ${pct * 360}deg, #EAF6FB 0deg)` }}
      >
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-[#34374A] bg-white text-sm font-bold tabular-nums" aria-live="polite">
          {left === 0 ? "🔔" : formatTimer(left)}
        </span>
      </div>
      <div className="text-sm">
        <p className="font-bold">{running ? "Timer running… I'll cheer when it's done." : left === 0 ? "Ding! Time's up!" : "Tap start when the step begins."}</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              if (left === 0) {
                setLeft(total);
                setRunning(true);
              } else setRunning((r) => !r);
            }}
            className={`px-3 py-1 text-sm ${ui.btn} ${ui.wobbleSm}`}
          >
            {running ? "Pause" : left === 0 ? "Restart" : "Start timer"}
          </button>
          <button
            onClick={() => {
              setTotal((t) => t + 60);
              setLeft((s) => s + 60);
            }}
            className={`px-3 py-1 text-sm ${ui.btnGhost} ${ui.wobbleSm}`}
          >
            +1 min
          </button>
        </div>
      </div>
    </div>
  );
}

/** The cook page: the font and paper wrap everything below. */
export function CookClient(props: { recipe: Recipe; pro: boolean; defaultServings: number; limits: Limits }) {
  return (
    <div className={`${ui.page} ${maru.className}`}>
      <FunStyles />
      <CookClientInner {...props} />
    </div>
  );
}

function CookClientInner({ recipe, pro, defaultServings, limits }: { recipe: Recipe; pro: boolean; defaultServings: number; limits: Limits }) {
  const [servings, setServings] = useState(defaultServings);
  const steps = recipe.steps.filter((s) => s.kind === "step");
  const tips = new Map(recipe.steps.filter((s) => s.kind === "tip").map((t) => [t.stepNo, t]));
  const [index, setIndex] = useState(0);
  const step: Chunk | undefined = steps[index];
  const names = new Map(recipe.ingredients.map((i) => [i.ingredientId, i.name]));
  const chunkById = new Map([...recipe.steps, ...recipe.faqs].map((c) => [c.id, c]));
  const minutesLeft = Math.max(1, Math.round((recipe.minutes * (steps.length - index)) / Math.max(1, steps.length)));

  // ---- coach (ASK)
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [thread, setThread] = useState<{ q: string; a: CookAnswer }[]>([]);
  const [asking, setAsking] = useState(false);
  const [askFailure, setAskFailure] = useState<Failure | null>(null);
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const lastQuestion = useRef("");

  async function ask(text: string) {
    if (!text.trim() || asking) return;
    lastQuestion.current = text;
    setAsking(true);
    setAskFailure(null);
    const res = await post<CookAnswer>(`/api/cook/${recipe.id}/ask`, { question: text, ...(sessionId ? { sessionId } : {}) });
    setAsking(false);
    if (!res.ok) return setAskFailure(res.failure);
    setSessionId(res.data.sessionId);
    setThread((t) => [...t, { q: text, a: res.data }]);
    setQuestion("");
  }
  const askQuick = (q: string) => ask(step?.stepNo ? `${q} (I'm on step ${step.stepNo})` : q);

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

  // ---------------------------------------------------------------- frame 9: confirm & learn
  if (done) {
    return (
      <section className="mx-auto w-full max-w-xl p-6">
        {confirmed && <Confetti />}
        <div className={`cooky-pop relative flex items-center gap-4 bg-[#FFF0F3] p-4 shadow-[4px_4px_0_0_#A8D8EA] ${ui.frame} ${ui.wobble}`}>
          <Washi className="-top-2 right-8" />
          <Mascot mood={confirmed ? "cheer" : "proud"} size={80} className={confirmed ? "cooky-wiggle shrink-0" : "cooky-float shrink-0"} />
          <div>
            <h1 className={`text-2xl ${ui.heading}`}>{confirmed ? "All logged, chef! 🌸" : `Nice cooking! ${dishEmoji(recipe.title)}`}</h1>
            <p className={`mt-1 text-sm ${ui.muted}`}>
              {confirmed ? `${recipe.title} is done and your fridge is up to date.` : "Check what you used. Your fridge only changes when you confirm."}
            </p>
          </div>
        </div>

        {!confirmed && (
          <>
            <h2 className={`mt-6 flex items-center gap-2 ${ui.heading}`}><Sakura size={18} /> What you used</h2>
            <ul className={`mt-2 divide-y-2 divide-dashed divide-[#A8D8EA]/60 bg-white ${ui.frame} ${ui.wobble} shadow-[4px_4px_0_0_#A8D8EA]`}>
              {groups.map((g) => (
                <li key={g.ingredientId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="text-sm">
                    <p className="font-bold">{names.get(g.ingredientId) ?? g.ingredientId}</p>
                    <p className={`text-xs ${ui.muted}`}>
                      {g.items.length > 1 ? `older pack first · ${g.items.map((d) => formatQty(d.qty, d.unit)).join(" + ")}` : "from your fridge"}
                      {g.shortBy !== null && <span className="font-bold text-[#C2577A]"> · fridge is {formatQty(g.shortBy, g.unit)} short</span>}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="number" min={0} step="any" inputMode="decimal"
                      aria-label={`Amount of ${names.get(g.ingredientId) ?? g.ingredientId} used`}
                      value={amounts[g.ingredientId] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [g.ingredientId]: e.target.value }))}
                      className={`w-20 border-2 border-[#34374A]/60 bg-white px-2 py-1.5 text-right font-bold outline-none focus:border-[#6C8EBF] ${ui.wobbleSm}`}
                    />
                    <span className={`w-8 ${ui.muted}`}>{g.unit === "count" ? "" : g.unit}</span>
                  </label>
                </li>
              ))}
              {(done.missing ?? []).map((m) => (
                <li key={m.ingredientId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-bold">{names.get(m.ingredientId) ?? m.ingredientId}</p>
                    <p className={`text-xs ${ui.muted}`}>Not in your fridge, so nothing to take off</p>
                  </div>
                  <span className={ui.muted}>–</span>
                </li>
              ))}
              {groups.length === 0 && (done.missing ?? []).length === 0 && <li className="px-4 py-3 text-sm">Nothing from your fridge to take off.</li>}
            </ul>

            <div className={`mt-4 flex items-center justify-between gap-3 bg-white px-4 py-3 ${ui.frame} ${ui.wobbleSm}`}>
              <div className="text-sm">
                <p className="font-bold">🥡 Save leftovers</p>
                <p className={`text-xs ${ui.muted}`}>Goes in the fridge as a dish · keeps about {leftoverDays} days (typical guide, USDA FoodKeeper)</p>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label="One fewer leftover serving" onClick={() => setLeftovers((n) => Math.max(0, n - 1))} className={`h-9 w-9 text-lg ${ui.btnGhost} rounded-full`}>−</button>
                <span className="w-5 text-center text-lg font-bold tabular-nums" aria-live="polite">{leftovers}</span>
                <button aria-label="One more leftover serving" onClick={() => setLeftovers((n) => Math.min(limits.servingsMax, n + 1))} className={`h-9 w-9 text-lg ${ui.btnGhost} rounded-full`}>+</button>
              </div>
            </div>

            <div className={`mt-4 bg-white px-4 py-3 ${ui.frame} ${ui.wobbleSm}`}>
              <p className="text-sm font-bold">😋 How was it?</p>
              <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setRating(rating === n ? null : n)}
                    className={`text-3xl leading-none transition hover:scale-125 active:scale-90 ${rating !== null && n <= rating ? "text-[#F2C14E] drop-shadow-[1px_1px_0_#34374A]" : "text-[#D9DCE6]"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {rating !== null && <p key={rating} className="cooky-pop mt-1 text-xs font-bold text-[#4F6FA3]">{RATING_WORDS[rating]}</p>}
              <textarea
                value={feedback} maxLength={limits.feedbackMaxChars} onChange={(e) => setFeedback(e.target.value)} rows={2}
                placeholder="Tasty, but a bit dry" aria-label="A note for next time"
                className={`mt-2 w-full border-2 border-[#34374A]/40 bg-[#F7F9FC] px-3 py-2 text-sm outline-none focus:border-[#6C8EBF] ${ui.wobbleSm}`}
              />
              {pro && <p className={`mt-1 text-xs ${ui.muted}`}>Bao may suggest a preference from your note. Nothing is saved unless you choose it.</p>}
            </div>

            {badAmount && <p className="mt-3 text-sm font-bold text-[#C2577A]">Each amount must be a number of 0 or more.</p>}
            <button onClick={confirm} disabled={busy || badAmount} className={`mt-6 w-full px-4 py-3 text-base ${ui.btn} ${ui.wobbleSm}`}>
              {busy ? "Updating your fridge…" : "Confirm & update fridge ✓"}
            </button>
            <button
              onClick={() => {
                setDone(null);
                setDoneFailure(null);
              }}
              disabled={busy}
              className={`mt-3 w-full text-sm ${ui.link} disabled:opacity-50`}
            >
              ← Back to the steps
            </button>
            {doneFailure && <ErrorNote failure={doneFailure} onRetry={confirm} busy={busy} />}
          </>
        )}

        {confirmed && (
          <>
            {leftovers > 0 && <p className="mt-4 text-sm font-bold">🥡 {leftovers} leftover serving{leftovers > 1 ? "s" : ""} added to your fridge.</p>}
            {confirmed.proposals.map((p) => (
              <div key={p.id} className={`cooky-pop mt-4 bg-white p-4 shadow-[4px_4px_0_0_#FFB7C5] ${ui.frame} ${ui.wobbleSm}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#E58AA0]">🌸 Remember this for next time?</p>
                <p className="mt-1 text-lg font-bold">{p.value}</p>
                <p className={`text-xs ${ui.muted}`}>{p.reason}</p>
                {choices[p.id] === "always" || choices[p.id] === "once" || choices[p.id] === "dismiss" ? (
                  <p className="mt-2 text-sm font-bold text-[#4F6FA3]">{choices[p.id] === "always" ? "Saved. Your next plans will use it." : choices[p.id] === "once" ? "Used for your next plan only." : "Not saved."}</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => choose(p, "always")} disabled={choices[p.id] === "saving"} className={`px-3 py-1.5 text-sm ${ui.btnSakura} ${ui.wobbleSm}`}>Always</button>
                    <button onClick={() => choose(p, "once")} disabled={choices[p.id] === "saving"} className={`px-3 py-1.5 text-sm ${ui.btnGhost} ${ui.wobbleSm}`}>Just this time</button>
                    <button onClick={() => choose(p, "dismiss")} disabled={choices[p.id] === "saving"} className={`px-3 py-1.5 text-sm ${ui.btnGhost} ${ui.wobbleSm}`}>Don&apos;t save</button>
                  </div>
                )}
                {choices[p.id] === "error" && <p className="mt-2 text-sm text-[#C2577A]">That didn&apos;t save. You can set it later on the Preferences page.</p>}
              </div>
            ))}
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link className={`px-4 py-2 ${ui.btn} ${ui.wobbleSm}`} href="/fridge">🧊 See your fridge</Link>
              <Link className={`px-4 py-2 ${ui.btnGhost} ${ui.wobbleSm}`} href="/recipes">Cook something else</Link>
            </div>
          </>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------- frame 8: cook with Bao
  const tip = step ? tips.get(step.stepNo) : undefined;
  const mood: Mood = asking ? "thinking" : askFailure || doneFailure ? "worried" : timerDone ? "cheer" : thread.at(-1)?.a.notCovered ? "worried" : "happy";
  const bubble = asking
    ? "Hmm, let me check the recipe…"
    : timerDone
      ? "Ding! Time's up 🔔 On to the next bit!"
      : step
        ? stepCheer(index, steps.length)
        : "Let's cook!";
  return (
    <section className="mx-auto w-full max-w-xl p-6">
      <div className="flex items-center gap-3">
        <Link href={`/recipes/${recipe.id}`} aria-label="Back to the recipe" className={`flex h-10 w-10 items-center justify-center text-lg ${ui.btnGhost} rounded-full`}>‹</Link>
        <div className="min-w-0 flex-1">
          <h1 className={`truncate text-lg ${ui.heading}`}>{dishEmoji(recipe.title)} {recipe.title}</h1>
          <p className="text-xs font-bold text-[#4F6FA3]">Dinner in about {minutesLeft} min</p>
        </div>
        <div className="flex items-center gap-1" aria-label={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <span key={s.id} className={`h-3 w-3 rounded-full border-2 border-[#34374A] transition ${i < index ? "bg-[#6C8EBF]" : i === index ? "scale-125 bg-[#FFB7C5]" : "bg-white"}`} />
          ))}
        </div>
      </div>

      <details className={`mt-4 bg-white px-4 py-2 text-sm ${ui.cardSoft} ${ui.wobbleSm}`}>
        <summary className="cursor-pointer font-bold">
          🧺 Ingredients for{" "}
          <select value={servings} onChange={(e) => setServings(Number(e.target.value))} onClick={(e) => e.stopPropagation()} aria-label="Servings" className={`border-2 border-[#34374A]/50 bg-white px-1 ${ui.wobbleSm}`}>
            {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </summary>
        <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {recipe.ingredients.map((i) => (
            <li key={i.ingredientId} className="flex justify-between gap-3">
              <span>{i.name}{i.optional && <span className={`ml-1 text-xs ${ui.muted}`}>(optional)</span>}</span>
              <span className="font-bold tabular-nums">{formatQty(scaled(i.qty, recipe.baseServings, servings), i.unit)}</span>
            </li>
          ))}
        </ul>
      </details>

      {/* Bao and a speech bubble */}
      <div className="mt-6 flex items-end gap-2">
        <div className="relative shrink-0">
          <Steam className="absolute -top-5 left-6" />
          <Mascot mood={mood} size={84} className={timerDone ? "cooky-wiggle" : "cooky-float"} />
        </div>
        <p key={bubble} className={`cooky-pop relative mb-5 bg-white px-4 py-2 text-sm font-bold shadow-[3px_3px_0_0_#FFB7C5] ${ui.frame} rounded-[18px_18px_18px_4px]`}>
          {bubble}
        </p>
      </div>

      {step ? (
        <div key={step.id} className={`cooky-slide relative mt-1 bg-white p-5 shadow-[5px_5px_0_0_#A8D8EA] ${ui.frame} ${ui.wobble}`}>
          <Washi className="-top-2 left-8" />
          <span className={`inline-block border-2 border-[#34374A] bg-[#A8D8EA] px-3 py-0.5 text-xs font-bold ${ui.wobbleSm}`}>Step {index + 1} of {steps.length}</span>
          <p className="mt-3 text-xl font-bold leading-snug">{step.text}</p>
          {step.timerSeconds && <Timer key={step.id} seconds={step.timerSeconds} onDone={() => setTimerDone(true)} />}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setTimerDone(false);
                setIndex((i) => i - 1);
              }}
              disabled={index === 0}
              className={`py-2.5 text-sm ${ui.btnGhost} ${ui.wobbleSm}`}
            >
              ← Back
            </button>
            <button
              onClick={() => {
                setTimerDone(false);
                setIndex((i) => i + 1);
              }}
              disabled={index === steps.length - 1}
              className={`py-2.5 text-sm ${ui.btn} ${ui.wobbleSm}`}
            >
              Next step →
            </button>
          </div>
        </div>
      ) : (
        <p className={`mt-6 text-sm ${ui.muted}`}>This recipe has no steps yet.</p>
      )}

      {/* the coach: the step's prep tip first, then answers to questions, each with its source */}
      <div className="mt-6 space-y-3" aria-live="polite">
        {tip && (
          <CoachCard>
            <p>💡 {tip.text}</p>
            <p className="mt-1 text-xs font-bold text-[#E58AA0]">From: tip for step {tip.stepNo}</p>
          </CoachCard>
        )}
        {thread.map(({ q, a }, i) => (
          <div key={i} className="space-y-2">
            <p className={`cooky-pop ml-auto w-fit max-w-[85%] bg-[#A8D8EA] px-3 py-2 text-sm font-bold ${ui.frame} rounded-[16px_16px_4px_16px]`}>{q}</p>
            <CoachCard mood={a.notCovered ? "worried" : "happy"}>
              <p>{a.answer}</p>
              {a.notCovered && (
                <p className={`mt-1 text-xs ${ui.muted}`}>I only answer from this recipe, so I won&apos;t guess. Try saying it another way, or tap a quick question below.</p>
              )}
              {a.citations.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-bold text-[#E58AA0]">From:</span>
                  {a.citations.map((c) => (
                    <button
                      key={c.chunkId}
                      onClick={() => setOpenCitation(openCitation === `${i}:${c.chunkId}` ? null : `${i}:${c.chunkId}`)}
                      aria-expanded={openCitation === `${i}:${c.chunkId}`}
                      className={`border-2 border-[#E58AA0] bg-white px-2 py-0.5 font-bold text-[#B4536C] transition hover:bg-[#FFF0F3] ${ui.wobbleSm}`}
                    >
                      {c.kind === "tip" ? `Tip, step ${chunkById.get(c.chunkId)?.stepNo ?? ""}` : c.label.replace(/^FAQ:\s*/, "FAQ · ")}
                    </button>
                  ))}
                </p>
              )}
              {a.citations.map((c) =>
                openCitation === `${i}:${c.chunkId}` ? (
                  <blockquote key={c.chunkId} className={`cooky-pop mt-2 border-l-4 border-[#FFB7C5] bg-white/70 py-1 pl-3 text-xs ${ui.muted}`}>
                    {chunkById.get(c.chunkId)?.text ?? "This part of the recipe is no longer available."}
                  </blockquote>
                ) : null,
              )}
              {a.safetyTopic && (
                <p className={`mt-2 border-2 border-dashed border-[#F2C14E] bg-[#FFF9E6] p-2 text-xs ${ui.wobbleSm}`}>
                  ⚠️ For doneness, spoilage and allergens, follow the official guidance on <a className={ui.link} href={SAFETY_URL} target="_blank" rel="noopener noreferrer">FoodSafety.gov</a>.
                </p>
              )}
            </CoachCard>
          </div>
        ))}
        {asking && (
          <CoachCard mood="thinking">
            <p className={`flex items-center gap-2 ${ui.muted}`} role="status">Checking the recipe <ThinkingDots /></p>
          </CoachCard>
        )}
        {askFailure && <ErrorNote failure={askFailure} onRetry={() => ask(lastQuestion.current)} busy={asking} />}
      </div>

      {pro ? (
        <div className="mt-5">
          <p className={`text-xs font-bold ${ui.muted}`}>Ask Bao · one tap</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map(([emoji, q]) => (
              <button key={q} onClick={() => askQuick(q)} disabled={asking} className={`px-3 py-1 text-sm disabled:opacity-50 ${ui.chip} ${ui.wobbleSm}`}>
                <span aria-hidden>{emoji} </span>{q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={limits.questionMaxChars}
              placeholder="Ask Bao about this recipe…" aria-label="Your question"
              className={`min-w-0 flex-1 bg-white px-4 py-2 text-sm outline-none focus:border-[#6C8EBF] ${ui.frame} ${ui.wobbleSm}`}
            />
            <button disabled={asking || !question.trim()} className={`px-4 text-sm ${ui.btnSakura} ${ui.wobbleSm}`}>Ask</button>
          </form>
        </div>
      ) : (
        <p className={`mt-5 bg-white p-3 text-sm ${ui.cardSoft} ${ui.wobbleSm}`}>
          🌸 Asking Bao while you cook is part of Cooky Pro; steps, timers and tips stay free. <Link className={ui.link} href="/billing">Unlock Pro</Link>
        </p>
      )}

      <button onClick={finish} disabled={busy} className={`mt-6 w-full py-3 text-base ${ui.btn} ${ui.wobbleSm}`}>
        {busy ? "Checking your fridge…" : "I'm done, time to eat 🍽️"}
      </button>
      {doneFailure && <ErrorNote failure={doneFailure} onRetry={finish} busy={busy} />}
    </section>
  );
}

function CoachCard({ children, mood = "happy" }: { children: ReactNode; mood?: Mood }) {
  return (
    <div className="cooky-pop flex gap-2">
      <Mascot mood={mood} size={44} className="mt-1 shrink-0" />
      <div className={`flex-1 bg-[#FFF0F3] p-3 text-sm ${ui.frame} rounded-[4px_18px_18px_18px]`}>
        <p className="text-xs font-bold uppercase tracking-wide text-[#E58AA0]">Bao, your coach</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
