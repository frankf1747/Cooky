// Owner: Platform. The script that sets <html data-theme> before the first paint (app/layout.tsx).
// A plain module, not a client one, because the server layout needs the script as a string; the
// switch itself is src/ui/theme.ts.
export const THEME_KEY = "cooky-theme";
export const THEME_EVENT = "cooky-theme";

/**
 * Runs inline in <head> before anything paints: reads the choice, resolves "system" against the
 * device, sets data-theme, and keeps following the device while the choice is "system".
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function c(){try{return localStorage.getItem("${THEME_KEY}")}catch(e){return null}}function a(){var t=c();d.dataset.theme=t==="dark"||(t!=="light"&&m.matches)?"dark":"light"}a();m.addEventListener("change",a);window.addEventListener("${THEME_EVENT}",a)})()`;
