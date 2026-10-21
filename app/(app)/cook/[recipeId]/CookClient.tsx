"use client";
// Owner: Recipes & Cook. Cook mode: scaled ingredients, one step at a time with timers and tips
// (CK1), the assistant with citation chips (ASK1–ASK5), and Done → review → confirm (CK2–CK3).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CookAnswer, Recipe } from "@spec/contract";
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

const SAFETY_URL = "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures";

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
          <button onClick={onRetry} disabled={busy} className="underline disabled:opacity-50">Try again</button>
        )}
        {failure.upgrade && <Link className="underline" href="/billing">Unlock Pro</Link>}
      </div>
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, left]);
  return (
    <div className="mt-3 flex items-center gap-3 text-sm">
      <span className={`tabular-nums text-lg ${left === 0 ? "text-green-700 dark:text-green-400" : ""}`} aria-live="polite">
        {left === 0 ? "Time's up" : formatTimer(left)}
      </span>
      <button onClick={() => setRunning((r) => !r)} disabled={left === 0} className="rounded-md border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700">
        {running ? "Pause" : "Start timer"}
      </button>
      <button
        onClick={() => {
          setRunning(false);
          setLeft(seconds);
        }}
        className="text-zinc-500 underline"
      >
        Reset
      </button>
    </div>
  );
}

export function CookClient({ recipe, pro, defaultServings, limits }: { recipe: Recipe; pro: boolean; defaultServings: number; limits: Limits }) {
  const [servings, setServings] = useState(defaultServings);
  const steps = recipe.steps.filter((s) => s.kind === "step");
  const tips = new Map(recipe.steps.filter((s) => s.kind === "tip").map((t) => [t.stepNo, t]));
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const names = new Map(recipe.ingredients.map((i) => [i.ingredientId, i.name]));
  const chunkById = new Map([...recipe.steps, ...recipe.faqs].map((c) => [c.id, c]));

  // ---- assistant
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

  // ---- done and confirm
  const [done, setDone] = useState<DoneResult | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [leftovers, setLeftovers] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneFailure, setDoneFailure] = useState<Failure | null>(null);
  const [confirmed, setConfirmed] = useState<{ proposals: Proposal[] } | null>(null);

  async function finish() {
    if (busy) return;
    setBusy(true);
    setDoneFailure(null);
    const res = await post<DoneResult>(`/api/cook/${recipe.id}/done`, { servings });
    setBusy(false);
    if (!res.ok) return setDoneFailure(res.failure);
    setDone(res.data);
    setAmounts(Object.fromEntries(res.data.deductions.map((d) => [d.itemId, String(Math.round(d.qty * 100) / 100)])));
    setLeftovers(res.data.leftovers.servings);
  }

  const badAmount = done?.deductions.some((d) => !(Number(amounts[d.itemId]) >= 0) || amounts[d.itemId] === "") ?? false;

  async function confirm() {
    if (!done || busy || badAmount) return;
    setBusy(true);
    setDoneFailure(null);
    const res = await post<{ proposals: Proposal[] }>(`/api/cook/events/${done.cookEventId}/confirm`, {
      deductions: done.deductions.map((d) => ({ itemId: d.itemId, qty: Number(amounts[d.itemId]) })),
      leftoverServings: leftovers,
      ...(rating ? { rating } : {}),
      ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
    });
    setBusy(false);
    if (!res.ok) return setDoneFailure(res.failure);
    setConfirmed({ proposals: res.data.proposals ?? [] });
  }

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-8 p-6 lg:grid-cols-[3fr_2fr]">
      <div>
        <Link href={`/recipes/${recipe.id}`} className="text-sm text-zinc-500 hover:underline">← {recipe.title}</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cooking: {recipe.title}</h1>

        <label className="mt-4 flex items-center gap-3 text-sm">
          Servings
          <select value={servings} onChange={(e) => setServings(Number(e.target.value))} disabled={Boolean(done)} className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700">
            {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-zinc-500">recipe is written for {recipe.baseServings}</span>
        </label>

        <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {recipe.ingredients.map((i) => (
            <li key={i.ingredientId} className="flex justify-between gap-3 border-b border-zinc-100 py-1 dark:border-zinc-800">
              <span>{i.name}{i.optional && <span className="ml-1 text-xs text-zinc-500">(optional)</span>}</span>
              <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{formatQty(scaled(i.qty, recipe.baseServings, servings), i.unit)}</span>
            </li>
          ))}
        </ul>

        {step ? (
          <div className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Step {index + 1} of {steps.length}</p>
            <p className="mt-2 text-lg leading-relaxed">{step.text}</p>
            {step.timerSeconds && <Timer key={step.id} seconds={step.timerSeconds} />}
            {tips.get(step.stepNo) && <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">While you wait: {tips.get(step.stepNo)!.text}</p>}
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setIndex((i) => i - 1)} disabled={index === 0} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700">Back</button>
              {index < steps.length - 1 ? (
                <button onClick={() => setIndex((i) => i + 1)} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">Next step</button>
              ) : (
                !done && (
                  <button onClick={finish} disabled={busy} className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                    {busy ? "Checking your fridge…" : "Done cooking"}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">This recipe has no steps yet.</p>
        )}

        {!done && doneFailure && <ErrorNote failure={doneFailure} onRetry={finish} busy={busy} />}

        {done && !confirmed && (
          <div className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="font-semibold">What did you use?</h2>
            <p className="mt-1 text-sm text-zinc-500">Nothing changes in your fridge until you confirm. Adjust any amount that&apos;s off.</p>
            {done.deductions.length === 0 ? (
              <p className="mt-3 text-sm">None of this recipe&apos;s ingredients are in your fridge, so there is nothing to take out.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {done.deductions.map((d) => (
                  <li key={d.itemId} className="flex items-center justify-between gap-3">
                    <span>
                      {names.get(d.ingredientId) ?? d.ingredientId}
                      {d.shortBy !== null && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">fridge is {formatQty(d.shortBy, d.unit)} short</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <input
                        type="number" min={0} step="any" inputMode="decimal" aria-label={`Amount of ${names.get(d.ingredientId) ?? d.ingredientId} used`}
                        value={amounts[d.itemId] ?? ""}
                        onChange={(e) => setAmounts((a) => ({ ...a, [d.itemId]: e.target.value }))}
                        className="w-24 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-right dark:border-zinc-700"
                      />
                      <span className="w-10 text-zinc-500">{d.unit === "count" ? "" : d.unit}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {done.missing && done.missing.length > 0 && (
              <p className="mt-3 text-xs text-zinc-500">
                Not tracked in your fridge, so nothing to deduct: {done.missing.map((m) => names.get(m.ingredientId) ?? m.ingredientId).join(", ")}.
              </p>
            )}
            <label className="mt-4 flex items-center gap-3 text-sm">
              Leftover servings to keep
              <input type="number" min={0} max={limits.servingsMax} value={leftovers} onChange={(e) => setLeftovers(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="w-16 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-right dark:border-zinc-700" />
            </label>
            {leftovers > 0 && <p className="mt-1 text-xs text-zinc-500">Typical guide: eat by {done.leftovers.expiresOn} (USDA FoodKeeper leftovers, shorter end). Not safety advice.</p>}
            <fieldset className="mt-4 text-sm">
              <legend>How was it? <span className="text-zinc-500">(optional)</span></legend>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={rating === n} onClick={() => setRating(rating === n ? null : n)} className={`h-8 w-8 rounded-md border text-sm ${rating === n ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}>{n}</button>
                ))}
              </div>
            </fieldset>
            <label className="mt-3 block text-sm">
              Anything to remember next time? <span className="text-zinc-500">(optional)</span>
              <textarea value={feedback} maxLength={limits.feedbackMaxChars} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder="e.g. a bit dry, too spicy, loved it" className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" />
            </label>
            {badAmount && <p className="mt-2 text-sm text-red-700">Each amount must be a number of 0 or more.</p>}
            <button onClick={confirm} disabled={busy || badAmount} className="mt-4 rounded-md bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">
              {busy ? "Updating your fridge…" : "Confirm and update fridge"}
            </button>
            {doneFailure && <ErrorNote failure={doneFailure} onRetry={confirm} busy={busy} />}
          </div>
        )}

        {confirmed && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-5 text-sm dark:border-green-900 dark:bg-green-950">
            <p className="font-medium">Your fridge is updated.{leftovers > 0 ? ` ${leftovers} leftover serving${leftovers > 1 ? "s" : ""} added.` : ""}</p>
            {confirmed.proposals.length > 0 && (
              <p className="mt-2">Cooky noticed a preference from your note. Review it on <Link className="underline" href="/preferences">Preferences</Link>.</p>
            )}
            <div className="mt-3 flex gap-4">
              <Link className="underline" href="/fridge">See your fridge</Link>
              <Link className="underline" href="/recipes">Back to recipes</Link>
            </div>
          </div>
        )}
      </div>

      <aside className="h-fit rounded-lg border border-zinc-200 p-5 dark:border-zinc-800 lg:sticky lg:top-6">
        <h2 className="font-semibold">Ask about this recipe</h2>
        <p className="mt-1 text-xs text-zinc-500">Answers come only from this recipe and point to the step or tip they use.</p>
        {!pro ? (
          <p className="mt-3 text-sm">The cooking assistant is part of Cooky Pro. The steps, timers and tips stay free. <Link className="underline" href="/billing">Unlock Pro</Link></p>
        ) : (
          <>
            <ul className="mt-3 space-y-4 text-sm" aria-live="polite">
              {thread.length === 0 && <li className="text-zinc-500">Try “I don&apos;t have a wok” or “what do I do in step 2?”</li>}
              {thread.map(({ q, a }, i) => (
                <li key={i}>
                  <p className="font-medium">{q}</p>
                  <p className="mt-1">{a.answer}</p>
                  {a.citations.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {a.citations.map((c) => (
                        <button key={c.chunkId} onClick={() => setOpenCitation(openCitation === `${i}:${c.chunkId}` ? null : `${i}:${c.chunkId}`)} aria-expanded={openCitation === `${i}:${c.chunkId}`} className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                          {c.kind === "tip" ? `Tip, step ${chunkById.get(c.chunkId)?.stepNo ?? ""}` : c.label}
                        </button>
                      ))}
                    </p>
                  )}
                  {a.citations.map((c) =>
                    openCitation === `${i}:${c.chunkId}` ? (
                      <blockquote key={c.chunkId} className="mt-2 border-l-2 border-zinc-300 pl-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">{chunkById.get(c.chunkId)?.text ?? "This part of the recipe is no longer available."}</blockquote>
                    ) : null,
                  )}
                  {a.safetyTopic && (
                    <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      For doneness, spoilage and allergens, follow the official guidance on <a className="underline" href={SAFETY_URL} target="_blank" rel="noopener noreferrer">FoodSafety.gov</a>.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
              className="mt-4"
            >
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={limits.questionMaxChars} rows={2} placeholder="Ask a question…" aria-label="Your question" className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>{question.length}/{limits.questionMaxChars}</span>
                <button disabled={asking || !question.trim()} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">{asking ? "Thinking…" : "Ask"}</button>
              </div>
            </form>
            {askFailure && <ErrorNote failure={askFailure} onRetry={() => ask(lastQuestion.current)} busy={asking} />}
          </>
        )}
      </aside>
    </section>
  );
}
