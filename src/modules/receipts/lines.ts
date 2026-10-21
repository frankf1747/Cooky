// Receipt line rules, all in code (SPEC RCT3, RCT4, RCT10). The model reads the receipt; this
// file decides what each line means for the fridge: base unit, location, typical expiry date
// and whether it is auto-accepted, stocked as a generic item, flagged or ignored.
import type { Category, Location, ReceiptExtraction, ReceiptLine, Unit } from "@spec/contract";
import { toBase } from "@/platform/units";

type Extracted = ReceiptExtraction["lines"][number];
type ShelfLife = { fridge?: number; freezer?: number; pantry?: number };
type FlagReason = NonNullable<ReceiptLine["flagReason"]>;

export type CatalogIngredient = {
  id: string;
  name: string;
  category: Category;
  baseUnit: Unit;
  shelfLifeDays: ShelfLife;
  plausibleMaxQty: number | null;
};
export type CatalogProduct = { ingredientId: string; packageSize: number; unit: Unit };
export type LineCatalog = {
  ingredients: Map<string, CatalogIngredient>;
  products: CatalogProduct[];
  categoryDefaults: Map<Category, ShelfLife>;
};
export type LineDates = { purchasedOn: string | null; today: string };

/** A classified line, minus the id the caller assigns. */
export type ClassifiedLine = Omit<ReceiptLine, "lineId">;

const SHELF_STABLE: ReadonlySet<Category> = new Set(["pantry", "snacks", "beverages"]);

/**
 * `ASSUMED:` the SPEC says "ingredient default" without defining it. Frozen food goes to the
 * freezer, shelf-stable categories to the pantry, everything else to the fridge; when the
 * preferred place has no shelf life, the first of fridge, pantry, freezer that does.
 */
export function defaultLocation(category: Category, shelf: ShelfLife): Location | null {
  if (category === "frozen" && shelf.freezer) return "freezer";
  if (SHELF_STABLE.has(category) && shelf.pantry) return "pantry";
  for (const loc of ["fridge", "pantry", "freezer"] as const) if (shelf[loc]) return loc;
  return null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function placement(category: Category, shelf: ShelfLife, fallback: ShelfLife | undefined, dates: LineDates) {
  const location = defaultLocation(category, shelf) ?? (fallback ? defaultLocation(category, fallback) : null);
  if (!location) return { location: null, expiresOn: null };
  const days = shelf[location] ?? fallback?.[location];
  return { location, expiresOn: days ? addDays(dates.purchasedOn ?? dates.today, days) : null };
}

/** Printed quantity × package count in a base unit; "bunch" goes through the product's package size. */
function convert(e: Extracted, ingredientId: string | null, catalog: LineCatalog): { qty: number; unit: Unit } | null {
  if (e.qty === null || e.unit === null) return null;
  const printed = e.qty * (e.packageCount ?? 1);
  if (e.unit.trim().toLowerCase().replace(/e?s$/, "") === "bunch") {
    const products = catalog.products.filter((p) => p.ingredientId === ingredientId);
    if (products.length !== 1) return null;
    return { qty: printed * products[0].packageSize, unit: products[0].unit };
  }
  return toBase(printed, e.unit);
}

export function classifyLine(e: Extracted, catalog: LineCatalog, dates: LineDates): ClassifiedLine {
  const base = { raw: e.raw, kind: e.kind, name: e.name, priceCents: e.priceCents, confidence: e.confidence };
  if (e.kind !== "food") {
    return { ...base, ingredientId: null, category: null, qty: null, unit: null, decision: "ignored", flagReason: null, location: null, expiresOn: null };
  }
  const flagged = (reason: FlagReason, rest: Omit<ClassifiedLine, keyof typeof base | "decision" | "flagReason">): ClassifiedLine =>
    ({ ...base, ...rest, decision: "flagged", flagReason: reason });

  const ingredient = e.ingredientId ? catalog.ingredients.get(e.ingredientId) : undefined;

  if (!ingredient) {
    // No catalog match: a generic item (RCT10), or flagged. An id the catalog lacks is a model
    // guess, never silently turned into a generic item.
    const category = e.category;
    const converted = e.qty !== null && e.unit !== null ? toBase(e.qty * (e.packageCount ?? 1), e.unit) : null;
    const amount = converted && converted.unit !== "count"
      ? converted
      : { qty: converted?.qty ?? e.packageCount ?? 1, unit: "count" as const };
    const where = category ? placement(category, {}, catalog.categoryDefaults.get(category), dates) : { location: null, expiresOn: null };
    const rest = { ingredientId: null, category, ...amount, ...where };
    if (e.confidence !== "high") return flagged("low_confidence", rest);
    if (e.ingredientId !== null || category === null) return flagged("unknown_ingredient", rest);
    return { ...base, ...rest, decision: "generic", flagReason: null };
  }

  const where = placement(ingredient.category, ingredient.shelfLifeDays, catalog.categoryDefaults.get(ingredient.category), dates);
  const converted = convert(e, ingredient.id, catalog);
  const amount = converted && converted.unit === ingredient.baseUnit ? converted : null;
  const rest = { ingredientId: ingredient.id, category: ingredient.category, qty: amount?.qty ?? e.qty, unit: amount?.unit ?? null, ...where };

  if (e.confidence !== "high") return flagged("low_confidence", rest);
  if (e.qty === null) return flagged("quantity_missing", { ...rest, qty: null });
  if (!amount) return flagged("unit_unconvertible", rest);
  if (amount.qty <= 0 || (ingredient.plausibleMaxQty !== null && amount.qty > ingredient.plausibleMaxQty)) {
    return flagged("implausible_quantity", rest);
  }
  return { ...base, ...rest, decision: "auto", flagReason: null };
}
