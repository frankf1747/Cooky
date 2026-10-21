"use client";
// Owner: Recipes & Cook. Cook mode:
//   cook (CK1, ASK1–ASK5): one step at a time with its timer and prep tip, one-tap questions and
//       free questions answered from the recipe, with their sources.
//   confirm & learn (CK2–CK3, LRN): what you used (oldest pack first), leftovers, rating and a
//       note; preference suggestions to keep always, once, or not at all.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Chunk, CookAnswer, Recipe } from "@spec/contract";
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
/** One-tap questions; the current step is added so retrieval finds it. */
const QUICK = ["Is it done?", "It's sticking", "Short on time", "Keep it juicy"] as const;

const btn = "rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const btnGhost = "rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-zinc-700";
const card = "rounded-lg border border-zinc-200 dark:border-zinc-800";
const muted = "text-zinc-500";
const input = "rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

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
    <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p>{failure.message}</p>
      <div className="mt-2 flex gap-3">
        {failure.retry && onRetry && (
          <button onClick={onRetry} disabled={busy} className="font-medium underline disabled:opacity-50">Try again</button>
        )}
        {failure.upgrade && <Link className="font-medium underline" href="/billing">Unlock Pro</Link>}
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
  return (
    <div className={`mt-4 flex flex-wrap items-center gap-3 p-3 ${card}`}>
      <span className="text-2xl font-semibold tabular-nums" aria-live="polite">{left === 0 ? "Time's up" : formatTimer(left)}</span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{running ? "Timer running" : left === 0 ? "" : `of ${formatTimer(total)}`}</span>
      <div className="ml-auto flex gap-2">
        <button
          onClick={() => {
            if (left === 0) {
              setLeft(total);
              setRunning(true);
            } else setRunning((r) => !r);
          }}
          className={btn}
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

export function CookClient({ recipe, pro, defaultServings, limits }: { recipe: Recipe; pro: boolean; defaultServings: number; limits: Limits }) {
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

  // ---------------------------------------------------------------- confirm & learn
  if (done) {
    return (
      <section className="mx-auto w-full max-w-xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{confirmed ? "Logged" : "Done cooking"}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {confirmed ? `${recipe.title} is done and your fridge is up to date.` : "Check what you used. Your fridge only changes when you confirm."}
        </p>

        {!confirmed && (
          <>
            <h2 className="mt-6 font-semibold">What you used</h2>
            <ul className={`mt-2 divide-y divide-zinc-200 dark:divide-zinc-800 ${card}`}>
              {groups.map((g) => (
                <li key={g.ingredientId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="text-sm">
                    <p className="font-medium">{names.get(g.ingredientId) ?? g.ingredientId}</p>
                    <p className={`text-xs ${muted}`}>
                      {g.items.length > 1 ? `older pack first · ${g.items.map((d) => formatQty(d.qty, d.unit)).join(" + ")}` : "from your fridge"}
                      {g.shortBy !== null && <span className="text-amber-700 dark:text-amber-300"> · fridge is {formatQty(g.shortBy, g.unit)} short</span>}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="number" min={0} step="any" inputMode="decimal"
                      aria-label={`Amount of ${names.get(g.ingredientId) ?? g.ingredientId} used`}
                      value={amounts[g.ingredientId] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [g.ingredientId]: e.target.value }))}
                      className={`w-20 text-right ${input}`}
                    />
                    <span className={`w-8 ${muted}`}>{g.unit === "count" ? "" : g.unit}</span>
                  </label>
                </li>
              ))}
              {(done.missing ?? []).map((m) => (
                <li key={m.ingredientId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{names.get(m.ingredientId) ?? m.ingredientId}</p>
                    <p className={`text-xs ${muted}`}>Not in your fridge, so nothing to take off</p>
                  </div>
                </li>
              ))}
              {groups.length === 0 && (done.missing ?? []).length === 0 && <li className="px-4 py-3 text-sm">Nothing from your fridge to take off.</li>}
            </ul>

            <div className={`mt-4 flex items-center justify-between gap-3 px-4 py-3 ${card}`}>
              <div className="text-sm">
                <p className="font-medium">Save leftovers</p>
                <p className={`text-xs ${muted}`}>Goes in the fridge as a dish · keeps about {leftoverDays} days (typical guide, USDA FoodKeeper)</p>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label="One fewer leftover serving" onClick={() => setLeftovers((n) => Math.max(0, n - 1))} className={btnGhost}>−</button>
                <span className="w-5 text-center font-semibold tabular-nums" aria-live="polite">{leftovers}</span>
                <button aria-label="One more leftover serving" onClick={() => setLeftovers((n) => Math.min(limits.servingsMax, n + 1))} className={btnGhost}>+</button>
              </div>
            </div>

            <div className={`mt-4 px-4 py-3 ${card}`}>
              <p className="text-sm font-medium">How was it?</p>
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating out of 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n} role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`}
                    onClick={() => setRating(rating === n ? null : n)}
                    className={`h-9 w-9 rounded-md border text-sm ${rating !== null && n <= rating ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <textarea
                value={feedback} maxLength={limits.feedbackMaxChars} onChange={(e) => setFeedback(e.target.value)} rows={2}
                placeholder="Tasty, but a bit dry" aria-label="A note for next time"
                className={`mt-2 w-full ${input}`}
              />
              {pro && <p className={`mt-1 text-xs ${muted}`}>Cooky may suggest a preference from your note. Nothing is saved unless you choose it.</p>}
            </div>

            {badAmount && <p className="mt-3 text-sm text-red-700 dark:text-red-300">Each amount must be a number of 0 or more.</p>}
            <button onClick={confirm} disabled={busy || badAmount} className={`mt-6 w-full py-3 ${btn}`}>
              {busy ? "Updating your fridge…" : "Confirm and update fridge"}
            </button>
            <button
              onClick={() => {
                setDone(null);
                setDoneFailure(null);
              }}
              disabled={busy}
              className="mt-3 w-full text-sm underline disabled:opacity-50"
            >
              Back to the steps
            </button>
            {doneFailure && <ErrorNote failure={doneFailure} onRetry={confirm} busy={busy} />}
          </>
        )}

        {confirmed && (
          <>
            {leftovers > 0 && <p className="mt-4 text-sm">{leftovers} leftover serving{leftovers > 1 ? "s" : ""} added to your fridge.</p>}
            {confirmed.proposals.map((p) => (
              <div key={p.id} className={`mt-4 p-4 ${card}`}>
                <p className={`text-xs font-medium uppercase tracking-wide ${muted}`}>Remember this for next time?</p>
                <p className="mt-1 text-lg font-medium">{p.value}</p>
                <p className={`text-xs ${muted}`}>{p.reason}</p>
                {choices[p.id] === "always" || choices[p.id] === "once" || choices[p.id] === "dismiss" ? (
                  <p className="mt-2 text-sm">{choices[p.id] === "always" ? "Saved. Your next plans will use it." : choices[p.id] === "once" ? "Used for your next plan only." : "Not saved."}</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => choose(p, "always")} disabled={choices[p.id] === "saving"} className={btn}>Always</button>
                    <button onClick={() => choose(p, "once")} disabled={choices[p.id] === "saving"} className={btnGhost}>Just this time</button>
                    <button onClick={() => choose(p, "dismiss")} disabled={choices[p.id] === "saving"} className={btnGhost}>Don&apos;t save</button>
                  </div>
                )}
                {choices[p.id] === "error" && <p className="mt-2 text-sm text-red-700 dark:text-red-300">That didn&apos;t save. You can set it later on the Preferences page.</p>}
              </div>
            ))}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className={btn} href="/fridge">See your fridge</Link>
              <Link className={btnGhost} href="/recipes">Cook something else</Link>
            </div>
          </>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------- cook
  const tip = step ? tips.get(step.stepNo) : undefined;
  return (
    <section className="mx-auto w-full max-w-xl p-6">
      <Link href={`/recipes/${recipe.id}`} className="text-sm text-zinc-500 hover:underline">Back to the recipe</Link>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{recipe.title}</h1>
          <p className={`text-sm ${muted}`}>Dinner in about {minutesLeft} min</p>
        </div>
        {steps.length > 0 && <p className={`shrink-0 text-sm ${muted}`}>Step {index + 1} of {steps.length}</p>}
      </div>

      <details className={`mt-4 px-4 py-2 text-sm ${card}`}>
        <summary className="cursor-pointer font-medium">
          Ingredients for{" "}
          <select value={servings} onChange={(e) => setServings(Number(e.target.value))} onClick={(e) => e.stopPropagation()} aria-label="Servings" className="rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-900">
            {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </summary>
        <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {recipe.ingredients.map((i) => (
            <li key={i.ingredientId} className="flex justify-between gap-3">
              <span>{i.name}{i.optional && <span className={`ml-1 text-xs ${muted}`}>(optional)</span>}</span>
              <span className="tabular-nums">{formatQty(scaled(i.qty, recipe.baseServings, servings), i.unit)}</span>
            </li>
          ))}
        </ul>
      </details>

      {step ? (
        <div className={`mt-4 p-5 ${card}`}>
          <p className="text-lg leading-snug">{step.text}</p>
          {step.timerSeconds && <Timer key={step.id} seconds={step.timerSeconds} onDone={() => setTimerDone(true)} />}
          {timerDone && <p className="mt-2 text-sm" role="status">Time&apos;s up. On to the next bit.</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setTimerDone(false);
                setIndex((i) => i - 1);
              }}
              disabled={index === 0}
              className={btnGhost}
            >
              Back
            </button>
            <button
              onClick={() => {
                setTimerDone(false);
                setIndex((i) => i + 1);
              }}
              disabled={index === steps.length - 1}
              className={btn}
            >
              Next step
            </button>
          </div>
        </div>
      ) : (
        <p className={`mt-6 text-sm ${muted}`}>This recipe has no steps yet.</p>
      )}

      {/* the step's prep tip first, then answers to questions, each with its source */}
      <div className="mt-6 space-y-3" aria-live="polite">
        {tip && (
          <AnswerCard>
            <p>Tip: {tip.text}</p>
            <p className={`mt-1 text-xs ${muted}`}>From: tip for step {tip.stepNo}</p>
          </AnswerCard>
        )}
        {thread.map(({ q, a }, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">{q}</p>
            <AnswerCard>
              <p>{a.answer}</p>
              {a.notCovered && <p className={`mt-1 text-xs ${muted}`}>Cooky only answers from this recipe, so it won&apos;t guess. Try saying it another way, or use a quick question below.</p>}
              {a.citations.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={muted}>From:</span>
                  {a.citations.map((c) => (
                    <button
                      key={c.chunkId}
                      onClick={() => setOpenCitation(openCitation === `${i}:${c.chunkId}` ? null : `${i}:${c.chunkId}`)}
                      aria-expanded={openCitation === `${i}:${c.chunkId}`}
                      className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-700"
                    >
                      {c.kind === "tip" ? `Tip, step ${chunkById.get(c.chunkId)?.stepNo ?? ""}` : c.label.replace(/^FAQ:\s*/, "FAQ · ")}
                    </button>
                  ))}
                </p>
              )}
              {a.citations.map((c) =>
                openCitation === `${i}:${c.chunkId}` ? (
                  <blockquote key={c.chunkId} className={`mt-2 border-l-2 border-zinc-300 pl-3 text-xs dark:border-zinc-700 ${muted}`}>
                    {chunkById.get(c.chunkId)?.text ?? "This part of the recipe is no longer available."}
                  </blockquote>
                ) : null,
              )}
              {a.safetyTopic && (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  For doneness, spoilage and allergens, follow the official guidance on <a className="underline" href={SAFETY_URL} target="_blank" rel="noopener noreferrer">FoodSafety.gov</a>.
                </p>
              )}
            </AnswerCard>
          </div>
        ))}
        {asking && (
          <AnswerCard>
            <p className={muted} role="status">Checking the recipe…</p>
          </AnswerCard>
        )}
        {askFailure && <ErrorNote failure={askFailure} onRetry={() => ask(lastQuestion.current)} busy={asking} />}
      </div>

      {pro ? (
        <div className="mt-5">
          <p className={`text-xs ${muted}`}>Quick questions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} onClick={() => askQuick(q)} disabled={asking} className="rounded-full border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700">
                {q}
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
              placeholder="Ask about this recipe" aria-label="Your question"
              className={`min-w-0 flex-1 ${input}`}
            />
            <button disabled={asking || !question.trim()} className={btn}>Ask</button>
          </form>
        </div>
      ) : (
        <p className={`mt-5 p-3 text-sm ${card}`}>
          Asking questions while you cook is part of Cooky Pro; steps, timers and tips stay free. <Link className="underline" href="/billing">Unlock Pro</Link>
        </p>
      )}

      <button onClick={finish} disabled={busy} className={`mt-6 w-full py-3 ${btn}`}>
        {busy ? "Checking your fridge…" : "I'm done cooking"}
      </button>
      {doneFailure && <ErrorNote failure={doneFailure} onRetry={finish} busy={busy} />}
    </section>
  );
}

function AnswerCard({ children }: { children: ReactNode }) {
  return <div className={`p-3 text-sm ${card}`}>{children}</div>;
}
