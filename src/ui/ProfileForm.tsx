"use client";
// Owner: Platform. Onboarding and settings share this form (SPEC ACC3, journey step 1).
// v1 asks only household, budget, minutes, foods you never eat, staples and timezone; the v2
// fields (equipment, allergen tags, email alerts) are kept as stored.
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Profile } from "@spec/contract";
import type { ProfileFormData } from "@/modules/account";
import { btnPrimary, chip, chipOff, chipOn, field as input } from "./styles";

const noSubscribe = () => () => {};

type Limits = { servingsMin: number; servingsMax: number };
type Ingredient = ProfileFormData["ingredients"][number];

function errorText(status: number, body: { error?: string; code?: string }): string {
  if (status === 404) return "One of the foods you picked is no longer available. Reload the page and pick again.";
  if (status === 400) return body.error && body.error !== "Invalid input" ? `${body.error}.` : "Check the values above and try again.";
  if (status === 401) return "Your session ended. Log in again to save.";
  return "Cooky couldn't save your settings. Nothing changed; try again.";
}

function Chips({ label, hint, all, picked, onChange, disabled }: {
  label: string; hint: string; all: Ingredient[]; picked: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const shown = all.filter((i) => picked.includes(i.id) || i.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1 font-medium">{label} <span className="font-normal text-zinc-500">{hint}</span></legend>
      {all.length > 12 && (
        <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} className={`${input} max-w-xs`} />
      )}
      {all.length === 0 ? (
        <p className="text-zinc-500">The ingredient catalog is empty, so there is nothing to pick yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
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
          {shown.length === 0 && <p className="text-zinc-500">No food matches “{q}”.</p>}
        </div>
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
        router.push("/plan");
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
    <form onSubmit={submit} className="mt-6 flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          People you cook for
          <select className={input} value={household} disabled={busy} onChange={(e) => edit(setHousehold)(Number(e.target.value))}>
            {Array.from({ length: limits.servingsMax - limits.servingsMin + 1 }, (_, i) => limits.servingsMin + i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Weekly grocery budget ($)
          <input className={input} inputMode="decimal" value={budget} disabled={busy} onChange={(e) => edit(setBudget)(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Most minutes per meal
          <input className={input} inputMode="numeric" value={minutes} disabled={busy} onChange={(e) => edit(setMinutes)(e.target.value)} />
        </label>
      </div>

      <Chips label="Foods you never eat" hint="(never in a plan)" all={data.ingredients} picked={excluded} onChange={edit(setExcluded)} disabled={busy} />
      <Chips label="Staples you always have" hint="(never on a shopping list)" all={data.ingredients} picked={staples} onChange={edit(setStaples)} disabled={busy} />

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        Your timezone <span className="text-zinc-500">(for “today” and use-by dates)</span>
        <select className={input} value={timezone} disabled={busy} onChange={(e) => edit(setTimezone)(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
        </select>
      </label>

      <div className="flex flex-col items-stretch gap-2 sm:items-start">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : error ? "Try again" : mode === "onboarding" ? "Save and plan my week" : "Save settings"}
        </button>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Saved. Your next plan uses these settings.</p>}
      </div>
    </form>
  );
}
