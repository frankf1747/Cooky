"use client";
// Owner: Platform. Onboarding and settings share this form (SPEC ACC3, journey step 1).
// v1 asks only household, budget, minutes, foods you never eat, staples and timezone; the v2
// fields (equipment, allergen tags, email alerts) are kept as stored.
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Profile } from "@spec/contract";
import type { ProfileFormData } from "@/modules/account";
import { alert, btnPrimary, btnText, chip, chipOff, chipOn, field as input, h2, label as labelClass, notice } from "./styles";

const noSubscribe = () => () => {};

type Limits = { servingsMin: number; servingsMax: number };
type Ingredient = ProfileFormData["ingredients"][number];

function errorText(status: number, body: { error?: string; code?: string }): string {
  if (status === 404) return "One of the foods you picked is no longer available. Reload the page and pick again.";
  if (status === 400) return body.error && body.error !== "Invalid input" ? `${body.error}.` : "Check the values above and try again.";
  if (status === 401) return "Your session ended. Log in again to save.";
  return "Cooky couldn't save your settings. Nothing changed; try again.";
}

/** How many foods show before "Show all", so the picker is a short list and not a wall. */
const FOODS_SHOWN = 12;

function Chips({ title, hint, all, picked, onChange, disabled }: {
  title: string; hint: string; all: Ingredient[]; picked: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const query = q.trim().toLowerCase();
  // Picked foods first, then the rest; without a search, only the first few until "Show all".
  const ordered = [...all].sort((a, b) => Number(picked.includes(b.id)) - Number(picked.includes(a.id)));
  const matching = ordered.filter((i) => picked.includes(i.id) || i.name.toLowerCase().includes(query));
  const shown = query || showAll ? matching : matching.slice(0, Math.max(FOODS_SHOWN, picked.length));
  return (
    <fieldset className="border-t border-line pt-8">
      <legend className="sr-only">{title}</legend>
      <h2 className={h2} aria-hidden>{title}</h2>
      <p className="mt-1.5 text-[15px] text-muted">{hint}{picked.length > 0 && <> · <span className="font-medium text-foreground">{picked.length} picked</span></>}</p>
      {all.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">The ingredient catalog is empty, so there is nothing to pick yet.</p>
      ) : (
        <>
          {all.length > FOODS_SHOWN && (
            <input type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} className={`${input} mt-4 max-w-xs`} />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {shown.map((i) => {
              const on = picked.includes(i.id);
              return (
                <label key={i.id} className={`relative cursor-pointer ${chip} ${on ? chipOn : chipOff}`}>
                  <input type="checkbox" className="sr-only" checked={on} disabled={disabled}
                    onChange={(e) => onChange(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))} />
                  {i.name}
                </label>
              );
            })}
            {shown.length === 0 && <p className="text-[15px] text-muted">No food matches “{q}”.</p>}
          </div>
          {!query && matching.length > FOODS_SHOWN && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className={`mt-3 text-[15px] ${btnText}`}>
              {showAll ? "Show fewer" : `Show all ${all.length} foods`}
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}

export function ProfileForm({ data, limits, mode }: { data: ProfileFormData; limits: Limits; mode: "onboarding" | "settings" }) {
  const router = useRouter();
  const p = data.profile;
  const [household, setHousehold] = useState(p.householdSize);
  const [budget, setBudget] = useState((p.budgetCentsDefault / 100).toFixed(2));
  const [minutes, setMinutes] = useState(String(p.maxMinutesDefault));
  const [excluded, setExcluded] = useState(p.excludedIngredientIds);
  const [staples, setStaples] = useState(p.stapleIngredientIds);
  // First visit: suggest the browser's own timezone instead of the default (null = not chosen yet).
  const [chosenZone, setTimezone] = useState<string | null>(data.onboarded ? p.timezone : null);
  const browserZone = useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone || p.timezone, () => p.timezone);
  const timezone = chosenZone ?? browserZone;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone]);

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
    setError(null);
  };

  function problem(): string | null {
    const cents = Math.round(Number(budget) * 100);
    if (!budget.trim() || !Number.isFinite(cents) || cents < 0) return "Enter a weekly budget of $0 or more.";
    const m = Number(minutes);
    if (!Number.isInteger(m) || m <= 0) return "Enter the most minutes you want to spend on a meal, as a whole number.";
    const both = excluded.filter((id) => staples.includes(id));
    if (both.length) return "A food can't be both one you never eat and a staple you always have.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const p2 = problem();
    if (p2) return setError(p2);
    const body: Profile = {
      ...p,
      householdSize: household,
      budgetCentsDefault: Math.round(Number(budget) * 100),
      maxMinutesDefault: Number(minutes),
      excludedIngredientIds: excluded,
      stapleIngredientIds: staples,
      timezone,
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) return setError(errorText(res.status, await res.json().catch(() => ({}))));
      if (mode === "onboarding") {
        router.push("/fridge");
        router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError(errorText(0, {}));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-10">
      <fieldset>
        <legend className="sr-only">Your household</legend>
        <h2 className={h2} aria-hidden>Your household</h2>
        <p className="mt-1.5 text-[15px] text-muted">Every new plan starts from these. A plan can still change them.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            People you cook for
            <select className={input} value={household} disabled={busy} onChange={(e) => edit(setHousehold)(Number(e.target.value))}>
              {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Weekly grocery budget ($)
            <input className={input} inputMode="decimal" value={budget} disabled={busy} onChange={(e) => edit(setBudget)(e.target.value)} />
          </label>
          <label className={labelClass}>
            Most minutes per meal
            <input className={input} inputMode="numeric" value={minutes} disabled={busy} onChange={(e) => edit(setMinutes)(e.target.value)} />
          </label>
        </div>
      </fieldset>

      <Chips title="Foods you never eat" hint="Never in a plan" all={data.ingredients} picked={excluded} onChange={edit(setExcluded)} disabled={busy} />
      <Chips title="Staples you always have" hint="Never on a shopping list" all={data.ingredients} picked={staples} onChange={edit(setStaples)} disabled={busy} />

      <fieldset className="border-t border-line pt-8">
        <legend className="sr-only">Your timezone</legend>
        <h2 className={h2} aria-hidden>Your timezone</h2>
        <p className="mt-1.5 text-[15px] text-muted">For &ldquo;today&rdquo; and use-by dates.</p>
        <select aria-label="Your timezone" className={`${input} mt-4 max-w-xs`} value={timezone} disabled={busy} onChange={(e) => edit(setTimezone)(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
        </select>
      </fieldset>

      <div className="flex flex-col items-stretch gap-3 border-t border-line pt-8 sm:items-start">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : error ? "Try again" : mode === "onboarding" ? "Save and open my fridge" : "Save settings"}
        </button>
        {error && <p role="alert" className={alert}>{error}</p>}
        {saved && <p role="status" className={notice}>Saved. Your next plan uses these settings.</p>}
      </div>
    </form>
  );
}
