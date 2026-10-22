"use client";
// Owner: Platform. Light, dark or follow the device (Settings → Appearance). The choice is a
// per-device convenience, so it lives in localStorage, not the profile. <html data-theme> holds
// the scheme in force; THEME_SCRIPT (./themeScript.ts) sets it before the first paint, and the
// tokens in app/globals.css follow it.
import { useSyncExternalStore } from "react";
import { THEME_EVENT as EVENT, THEME_KEY as KEY } from "./themeScript";

export type ThemeChoice = "system" | "light" | "dark";

function read(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Saves the choice on this device and applies it at once (the head script listens for EVENT). */
export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked (a private window): the choice still applies until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
  if (choice !== "system") document.documentElement.dataset.theme = choice;
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, read, () => "system");
}
