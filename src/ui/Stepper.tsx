"use client";
// Owner: Platform. A number you change with − and +, never by typing or a dropdown: people, dishes,
// a budget. The value sits big in the middle in Fraunces with its unit under it, the buttons are
// 44px for a thumb, and each change is announced. A button greys out at its end of the range.
import type { ReactNode } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { btnIcon } from "./styles";

type Props = {
  /** What is counted, shown above the value ("People"). Also names the group for screen readers. */
  label: string;
  icon?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** The value as shown ("$40"). */
  format?: (v: number) => string;
  /** The unit under the value ("people", "a week"). */
  unit?: string;
  /** Names for the two buttons ("Fewer people", "More people"). */
  less: string;
  more: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** The lowest value allowed right now, if it is above `min` (a reason shows as a note). */
  floor?: { value: number; note: string };
};

export function Stepper({ label, icon, value, min, max, step = 1, format = String, unit, less, more, onChange, disabled, floor }: Props) {
  const low = Math.max(min, floor?.value ?? min);
  // Step to the next multiple of `step`, so a budget of $37.50 goes to $40, then $45.
  const down = Math.max(low, Math.ceil(value / step) * step - step);
  const up = Math.min(max, Math.floor(value / step) * step + step);
  const atFloor = floor && value <= floor.value && floor.value > min;
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-2.5 sm:p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
        {icon && <span aria-hidden className="text-subtle">{icon}</span>}
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <button type="button" aria-label={less} onClick={() => onChange(down)} disabled={disabled || value <= low} className={btnIcon}>
          <Minus size={18} weight="bold" aria-hidden />
        </button>
        <output aria-live="polite" className="flex min-w-0 flex-col items-center text-center">
          <span key={value} className="pop-in font-display text-[1.75rem] font-semibold leading-none tracking-[-0.02em] tabular-nums">{format(value)}</span>
          {unit && <span className="mt-1 whitespace-nowrap text-xs text-muted">{unit}</span>}
        </output>
        <button type="button" aria-label={more} onClick={() => onChange(up)} disabled={disabled || value >= max} className={btnIcon}>
          <Plus size={18} weight="bold" aria-hidden />
        </button>
      </div>
      {atFloor && <p className="mt-2 text-center text-xs text-muted">{floor.note}</p>}
    </div>
  );
}
