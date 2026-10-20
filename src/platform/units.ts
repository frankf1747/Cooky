// Unit conversion to Cooky's three base units. Code converts; the model never does arithmetic.
import type { Unit } from "@spec/contract";

const FACTORS: Record<string, { to: Unit; factor: number }> = {
  g: { to: "g", factor: 1 },
  gram: { to: "g", factor: 1 },
  grams: { to: "g", factor: 1 },
  kg: { to: "g", factor: 1000 },
  oz: { to: "g", factor: 28.349523125 },
  lb: { to: "g", factor: 453.59237 },
  lbs: { to: "g", factor: 453.59237 },
  ml: { to: "ml", factor: 1 },
  l: { to: "ml", factor: 1000 },
  "fl oz": { to: "ml", factor: 29.5735295625 },
  floz: { to: "ml", factor: 29.5735295625 },
  gal: { to: "ml", factor: 3785.411784 },
  count: { to: "count", factor: 1 },
  ea: { to: "count", factor: 1 },
  each: { to: "count", factor: 1 },
  ct: { to: "count", factor: 1 },
  pc: { to: "count", factor: 1 },
  pcs: { to: "count", factor: 1 },
};

/** Convert a quantity in a printed unit to g, ml or count. Returns null when it cannot convert. */
export function toBase(qty: number, unit: string): { qty: number; unit: Unit } | null {
  if (!Number.isFinite(qty) || qty < 0) return null;
  const key = unit.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
  const f = FACTORS[key];
  if (!f) return null;
  return { qty: Math.round(qty * f.factor * 100) / 100, unit: f.to };
}
