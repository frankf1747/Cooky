"use client";
// Owner: Recipes & Cook. Add a recipe from words (RCP5 text, RCP6): describe a dish or paste a
// recipe, Bao writes a draft (POST /api/recipes/import), the person fixes any flagged row, and
// POST /api/recipes saves it to their library. Nothing is saved before "Add to my recipes".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChefHat, X } from "@phosphor-icons/react";
import type { RecipeDraft } from "@spec/contract";
import { draftProblems, type CatalogEntry } from "@/modules/recipes/importer";
import { BaoSays } from "@/ui/Bao";
import { DishArt } from "@/ui/DishArt";
import { alert, btnPrimary, btnSecondary, btnText, chip, chipOff, chipRow, field, h2, label, panel, rows } from "@/ui/styles";
import { importErrorMessage, type ApiErrorBody } from "../ui";

type Failure = ReturnType<typeof importErrorMessage>;

const IDEAS = [
  "A cozy vegetarian soup for a cold night",
  "Crispy chicken with something green, ready in 25 minutes",
  "Something with the spinach and eggs in my fridge",
  "Spicy noodles, not too much washing up",
];

const FLAG_TEXT: Record<string, string> = {
  unknown_ingredient: "Not in Cooky's ingredient list. Pick the closest one, or take it out.",
  unit_unconvertible: "That measure doesn't convert. Enter the amount below.",
  quantity_missing: "No amount yet. Enter one below.",
};

async function send<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; failure: Failure }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as T } : { ok: false, failure: importErrorMessage(res.status, json as ApiErrorBody) };
  } catch {
    return { ok: false, failure: { message: "You seem to be offline. Nothing was saved; try again when you're connected.", retry: true } };
  }
}

export function AddRecipe({ catalog, maxChars }: { catalog: CatalogEntry[]; maxChars: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  // What "Try again" repeats: writing the draft, or saving it.
  const [failed, setFailed] = useState<"write" | "save">("write");
  const byId = new Map(catalog.map((c) => [c.id, c]));

  async function write() {
    if (!text.trim() || writing) return;
    setWriting(true);
    setFailure(null);
    const res = await send<{ draft: RecipeDraft }>("/api/recipes/import", { source: { kind: "text", text: text.trim() } });
    setWriting(false);
    if (!res.ok) {
      setFailed("write");
      return setFailure(res.failure);
    }
    setDraft(res.data.draft);
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setFailure(null);
    const res = await send<{ recipeId: string }>("/api/recipes", draft);
    if (!res.ok) {
      setSaving(false);
      setFailed("save");
      return setFailure(res.failure);
    }
    router.push(`/recipes/${res.data.recipeId}`);
  }

  function setRow(i: number, patch: Partial<RecipeDraft["ingredients"][number]>) {
    setDraft((d) => {
      if (!d) return d;
      const ingredients = d.ingredients.map((row, j) => {
        if (j !== i) return row;
        const next = { ...row, ...patch };
        const entry = next.ingredientId ? byId.get(next.ingredientId) : undefined;
        // A row is fixed once it is a catalog ingredient with an amount in that ingredient's unit.
        return { ...next, name: entry?.name ?? next.name, unit: entry?.baseUnit ?? next.unit, flagReason: entry && next.qty !== null && next.qty > 0 ? null : next.flagReason };
      });
      return { ...d, ingredients };
    });
    setFailure(null);
  }

  // ---------------------------------------------------------------- describe
  if (!draft) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <label className={label}>
          <span className="font-display text-xl font-semibold">What do you feel like eating?</span>
          <span className="font-normal text-muted">Describe a dish in your own words, or paste a whole recipe you love.</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFailure(null);
            }}
            maxLength={maxChars}
            rows={4}
            disabled={writing}
            placeholder="Something warm with noodles and a bit of heat, ready in 20 minutes"
            className={`${field} mt-2 min-h-32`}
          />
        </label>
        <div>
          <p className="text-[13px] font-medium text-muted">Or start from one of these</p>
          <div className={`mt-2 ${chipRow}`}>
            {IDEAS.map((idea) => (
              <button key={idea} type="button" onClick={() => setText(idea)} disabled={writing} className={`${chip} ${chipOff}`}>{idea}</button>
            ))}
          </div>
        </div>
        {writing ? (
          <BaoSays mood="thinking" pose="think" motion="breathe" size={72}>Writing it down. Tasting it in my head first. A few seconds.</BaoSays>
        ) : (
          <button type="button" onClick={write} disabled={!text.trim()} className={`w-full sm:w-auto sm:self-start ${btnPrimary}`}>
            <ChefHat size={20} weight="fill" aria-hidden />
            Write the recipe
          </button>
        )}
        {failure && <FailureNote failure={failure} onRetry={write} busy={writing} />}
      </div>
    );
  }

  // ---------------------------------------------------------------- review
  const problems = draftProblems(draft, catalog);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid items-center gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <DishArt id={draft.title} title={draft.title} className="shape-dome aspect-[4/3] w-44 sm:w-full" />
        <div>
          <p className="text-[13px] font-medium text-muted">Bao&apos;s draft · check it, then add it</p>
          <label className="sr-only" htmlFor="recipe-title">Recipe name</label>
          <textarea
            id="recipe-title"
            value={draft.title}
            maxLength={80}
            rows={2}
            onChange={(e) => setDraft({ ...draft, title: e.target.value.replace(/\n/g, " ") })}
            className="-ml-2 mt-1 w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1 font-display text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] transition [field-sizing:content] hover:border-line focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 sm:text-[1.75rem]"
          />
          <p className="mt-1 text-[15px] text-muted">{draft.minutes} min · serves {draft.baseServings}</p>
        </div>
      </div>

      <section aria-labelledby="draft-ingredients">
        <h2 id="draft-ingredients" className={h2}>Ingredients</h2>
        <ul className={`mt-4 ${rows}`}>
          {draft.ingredients.map((row, i) => {
            const entry = row.ingredientId ? byId.get(row.ingredientId) : undefined;
            return (
              <li key={i} className={`px-4 py-3.5 ${row.flagReason ? "bg-tomato-tint/40" : ""}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {entry && !row.flagReason ? (
                    <span className="min-w-0 flex-1 font-medium">{entry.name}</span>
                  ) : (
                    <label className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <span className="sr-only">Ingredient for {row.name}</span>
                      <select
                        value={row.ingredientId ?? ""}
                        onChange={(e) => setRow(i, { ingredientId: e.target.value || null })}
                        className={`${field} !py-2`}
                      >
                        <option value="">{row.name} (pick one)</option>
                        {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">Amount of {entry?.name ?? row.name}</span>
                    <input
                      type="number" min={0} step="any" inputMode="decimal"
                      value={row.qty ?? ""}
                      onChange={(e) => setRow(i, { qty: e.target.value === "" ? null : Number(e.target.value) })}
                      className={`${field} !w-24 !py-2 text-right tabular-nums`}
                    />
                    <span className="w-10 text-sm text-muted">{entry?.baseUnit === "count" ? "" : (entry?.baseUnit ?? row.unit ?? "")}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, j) => j !== i) })}
                    aria-label={`Take ${entry?.name ?? row.name} out`}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-foreground"
                  >
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </div>
                {row.flagReason && <p className="mt-1.5 text-sm text-tomato-ink">{FLAG_TEXT[row.flagReason] ?? "Check this row."}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="draft-steps">
        <h2 id="draft-steps" className={h2}>Method</h2>
        <ol className={`mt-4 divide-y divide-line ${panel}`}>
          {draft.steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 px-4 py-3.5">
              <span aria-hidden className="font-display text-xl font-semibold text-basil">{i + 1}</span>
              <p className="text-[15px] leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">Written by Bao from your words. Taste as you go; it&apos;s a starting point, not a promise.</p>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {problems.length > 0 && <p className="text-sm text-tomato-ink" aria-live="polite">{problems[0]}</p>}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button type="button" onClick={save} disabled={saving || problems.length > 0} className={btnPrimary}>
            {saving ? "Adding…" : "Add to my recipes"}
          </button>
          <button type="button" onClick={write} disabled={saving || writing} className={btnSecondary}>
            {writing ? "Writing another…" : "Write it again"}
          </button>
          <button type="button" onClick={() => setDraft(null)} disabled={saving || writing} className={`text-[15px] sm:ml-2 ${btnText}`}>
            Change what I asked
          </button>
        </div>
        {failure && <FailureNote failure={failure} onRetry={failed === "save" ? save : write} busy={saving || writing} />}
      </div>
    </div>
  );
}

function FailureNote({ failure, onRetry, busy }: { failure: Failure; onRetry?: () => void; busy: boolean }) {
  return (
    <div role="alert" className={alert}>
      <p>{failure.message}</p>
      {(failure.retry && onRetry) || failure.upgrade ? (
        <div className="mt-2 flex gap-4">
          {failure.retry && onRetry && <button type="button" onClick={onRetry} disabled={busy} className={btnText}>Try again</button>}
          {failure.upgrade && <Link className={btnText} href="/billing">Unlock Pro</Link>}
        </div>
      ) : null}
    </div>
  );
}
