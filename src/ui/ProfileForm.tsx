"use client";
// Owner: Platform. Onboarding and settings share this form (SPEC ACC3, journey step 1).
// v1 asks only household, budget, minutes, foods you never eat, staples and timezone; the v2
// fields (equipment, allergen tags, email alerts) are kept as stored.
//
// Settings shows it as grouped cards with one save bar that appears once something changed.
// Onboarding walks the same groups one at a time, with Bao saying what each one is for, and saves
// at the end. Numbers are steppers and times are a row of choices, as on the plan form.
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, Basket, Clock, CurrencyDollar, Globe, Prohibit, Timer, Users } from "@phosphor-icons/react";
import type { Profile } from "@spec/contract";
import type { ProfileFormData } from "@/modules/account";
import { BaoSays, type BaoMood, type BaoPose } from "./Bao";
import { BUDGET_MAX_CENTS, BUDGET_MIN_CENTS, BUDGET_STEP_CENTS, minuteChoices, usd } from "./basics";
import { Stepper } from "./Stepper";
import { alert, btnPrimary, btnSecondary, btnText, chip, chipOff, chipOn, chipRow, field as input, h3, notice } from "./styles";

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

/** One group of settings: an icon, a title, what it is for, then the controls. */
export function SettingsCard({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3" aria-hidden>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cobalt-tint text-cobalt-ink">{icon}</span>
        <div className="min-w-0">
          <p className={h3}>{title}</p>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

function FoodPicker({ label, all, picked, onChange, disabled }: {
  label: string; all: Ingredient[]; picked: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const query = q.trim().toLowerCase();
  // Picked foods first, then the rest; without a search, only the first few until "Show all".
  const ordered = [...all].sort((a, b) => Number(picked.includes(b.id)) - Number(picked.includes(a.id)));
  const matching = ordered.filter((i) => picked.includes(i.id) || i.name.toLowerCase().includes(query));
  const shown = query || showAll ? matching : matching.slice(0, Math.max(FOODS_SHOWN, picked.length));
  if (all.length === 0) return <p className="text-[15px] text-muted">The ingredient catalog is empty, so there is nothing to pick yet.</p>;
  return (
    <>
      {all.length > FOODS_SHOWN && (
        <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} className={`${input} mb-4`} />
      )}
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
        {shown.length === 0 && <p className="text-[15px] text-muted">No food matches “{q}”.</p>}
      </div>
      {!query && matching.length > FOODS_SHOWN && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={`mt-3 text-[15px] ${btnText}`}>
          {showAll ? "Show fewer" : `Show all ${all.length} foods`}
        </button>
      )}
    </>
  );
}

/** What Bao says on each onboarding step. */
const STEPS: { title: string; bao: string; mood: BaoMood; pose: BaoPose }[] = [
  { title: "Your household", bao: "Hi, I'm Bao. Who are we cooking for, and what does a week cost?", mood: "welcoming", pose: "wave" },
  { title: "Foods you never eat", bao: "Anything that never goes in a plan? Allergies, dislikes, all of it.", mood: "curious", pose: "rest" },
  { title: "Staples you always have", bao: "What's always in your kitchen? I'll keep it off every shopping list.", mood: "encouraging", pose: "hold" },
  { title: "Your timezone", bao: "Last one. This is how I know what 'today' and 'use by' mean for you.", mood: "reassuring", pose: "rest" },
];

export function ProfileForm({ data, limits, mode }: { data: ProfileFormData; limits: Limits; mode: "onboarding" | "settings" }) {
  const router = useRouter();
  const p = data.profile;
  const [household, setHousehold] = useState(p.householdSize);
  const [budgetCents, setBudgetCents] = useState(p.budgetCentsDefault);
  const [minutes, setMinutes] = useState(p.maxMinutesDefault);
  const [excluded, setExcluded] = useState(p.excludedIngredientIds);
  const [staples, setStaples] = useState(p.stapleIngredientIds);
  // First visit: suggest the browser's own timezone instead of the default (null = not chosen yet).
  const [chosenZone, setTimezone] = useState<string | null>(data.onboarded ? p.timezone : null);
  const browserZone = useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone || p.timezone, () => p.timezone);
  const timezone = chosenZone ?? browserZone;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // What was last saved, so the save bar only shows once something differs from it.
  const [base, setBase] = useState(() => JSON.stringify([p.householdSize, p.budgetCentsDefault, p.maxMinutesDefault, p.excludedIngredientIds, p.stapleIngredientIds, p.timezone]));
  const current = JSON.stringify([household, budgetCents, minutes, excluded, staples, timezone]);
  const dirty = current !== base;

  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone]);

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
    setError(null);
  };

  const conflict = excluded.some((id) => staples.includes(id));

  async function save() {
    if (busy) return;
    if (conflict) return setError("A food can't be both one you never eat and a staple you always have.");
    const body: Profile = {
      ...p,
      householdSize: household,
      budgetCentsDefault: budgetCents,
      maxMinutesDefault: minutes,
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
        setBase(current);
        router.refresh();
      }
    } catch {
      setError(errorText(0, {}));
    } finally {
      setBusy(false);
    }
  }

  const groups: ReactNode[] = [
    <SettingsCard key="household" icon={<Users size={18} weight="bold" />} title="Your household" hint="Every new plan starts from these. A plan can still change them.">
      <div className="grid gap-3 min-[400px]:grid-cols-2">
        <Stepper
          label="People"
          icon={<Users size={16} weight="bold" />}
          value={household}
          min={limits.servingsMin}
          max={limits.servingsMax}
          unit={household === 1 ? "person" : "people"}
          less="Fewer people"
          more="More people"
          onChange={edit(setHousehold)}
          disabled={busy}
        />
        <Stepper
          label="Budget"
          icon={<CurrencyDollar size={16} weight="bold" />}
          value={budgetCents}
          min={BUDGET_MIN_CENTS}
          max={BUDGET_MAX_CENTS}
          step={BUDGET_STEP_CENTS}
          format={usd}
          unit="a week"
          less="Lower the budget by $5"
          more="Raise the budget by $5"
          onChange={edit(setBudgetCents)}
          disabled={busy}
        />
      </div>
      <div role="radiogroup" aria-label="Most minutes per meal" className="mt-5">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <Timer size={16} weight="bold" aria-hidden className="text-subtle" />
          Time per meal, at most
        </p>
        <div className={`mt-2 ${chipRow}`}>
          {minuteChoices(p.maxMinutesDefault).map((m) => (
            <label key={m} className={`relative cursor-pointer ${chip} ${minutes === m ? chipOn : chipOff} tabular-nums`}>
              <input type="radio" name="maxMinutes" className="sr-only" checked={minutes === m} onChange={() => edit(setMinutes)(m)} disabled={busy} />
              {m} min
            </label>
          ))}
        </div>
      </div>
    </SettingsCard>,
    <SettingsCard
      key="never"
      icon={<Prohibit size={18} weight="bold" />}
      title="Foods you never eat"
      hint={<>Never in a plan{excluded.length > 0 && <> · <span className="font-medium text-foreground">{excluded.length} picked</span></>}</>}
    >
      <FoodPicker label="Foods you never eat" all={data.ingredients} picked={excluded} onChange={edit(setExcluded)} disabled={busy} />
    </SettingsCard>,
    <SettingsCard
      key="staples"
      icon={<Basket size={18} weight="bold" />}
      title="Staples you always have"
      hint={<>Never on a shopping list{staples.length > 0 && <> · <span className="font-medium text-foreground">{staples.length} picked</span></>}</>}
    >
      <FoodPicker label="Staples you always have" all={data.ingredients} picked={staples} onChange={edit(setStaples)} disabled={busy} />
    </SettingsCard>,
    <SettingsCard key="zone" icon={<Globe size={18} weight="bold" />} title="Your timezone" hint={<>For &ldquo;today&rdquo; and use-by dates.</>}>
      <div className="relative">
        <Clock size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
        <select aria-label="Your timezone" className={`${input} pl-11`} value={timezone} disabled={busy} onChange={(e) => edit(setTimezone)(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
        </select>
      </div>
    </SettingsCard>,
  ];

  const messages = (
    <>
      {error && <p role="alert" className={alert}>{error}</p>}
      {conflict && !error && <p role="alert" className={alert}>A food can&apos;t be both one you never eat and a staple you always have.</p>}
    </>
  );

  if (mode === "onboarding") {
    const last = step === STEPS.length - 1;
    const s = STEPS[step];
    // The two food steps are optional: with nothing picked, the button says so.
    const skippable = (step === 1 && excluded.length === 0) || (step === 2 && staples.length === 0);
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (last) void save();
          else setStep(step + 1);
        }}
        className="flex flex-col gap-6"
        aria-busy={busy}
      >
        {/* progress: one segment per step */}
        <div>
          <p className="text-[13px] font-medium text-muted">Step {step + 1} of {STEPS.length}</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-sunken"}`} />
            ))}
          </div>
        </div>
        <BaoSays key={step} mood={s.mood} pose={s.pose} motion="nod" size={72} className="rise-in">
          {s.bao}
        </BaoSays>
        <div key={`g${step}`} className="rise-in">{groups[step]}</div>
        {messages}
        <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 flex gap-2 sm:bottom-4 rounded-2xl border border-line bg-surface/95 p-3 shadow-float backdrop-blur-md">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} disabled={busy} aria-label="Back" className={`${btnSecondary} !px-4`}>
              <ArrowLeft size={18} weight="bold" aria-hidden />
            </button>
          )}
          <button type="submit" disabled={busy || (last && conflict)} className={`flex-1 ${btnPrimary}`}>
            {busy ? "Saving…" : last ? (error ? "Try again" : "Save and open my fridge") : skippable ? "Skip for now" : "Next"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-4"
      aria-busy={busy}
    >
      {groups}
      {messages}
      {saved && !dirty && <p role="status" className={notice}>Saved. Your next plan uses these settings.</p>}
      {/* the save bar appears only once something changed, above the tab bar on phones */}
      {dirty && (
        <div className="pop-in sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 pl-4 shadow-float backdrop-blur-md sm:bottom-4">
          <span className="text-sm text-muted">Unsaved changes</span>
          <button type="submit" disabled={busy || conflict} className={btnPrimary}>
            {busy ? "Saving…" : error ? "Try again" : "Save"}
          </button>
        </div>
      )}
    </form>
  );
}
