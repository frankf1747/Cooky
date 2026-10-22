"use client";
// Owner: Platform. Settings → Appearance: System, Light or Dark, as one segmented control. The
// choice applies at once and stays on this device (src/ui/theme.ts). Each option is a radio, so
// arrow keys move between them.
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { setTheme, useTheme, type ThemeChoice } from "./theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Desktop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSwitch() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-full bg-sunken p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = theme === value;
        return (
          <label
            key={value}
            className={`relative flex h-11 cursor-pointer select-none items-center justify-center gap-2 rounded-full text-sm font-medium transition duration-200 active:scale-[0.97] sm:h-10 ${on ? "bg-surface text-foreground shadow-float" : "text-muted hover:text-foreground"}`}
          >
            <input type="radio" name="theme" value={value} checked={on} onChange={() => setTheme(value)} className="sr-only" />
            <Icon size={18} weight={on ? "fill" : "regular"} aria-hidden />
            {label}
          </label>
        );
      })}
    </div>
  );
}
