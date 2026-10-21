// Owner: Platform. Profile and account summary (SPEC ACC3, ACC4).
import type { Me, Profile } from "@spec/contract";
import { reader, writer } from "@/platform/db";
import { DEFAULT_TIMEZONE } from "@/platform/dates";
import { badRequest, notFound, upstream } from "@/platform/errors";
import { QUOTA_FEATURES, quotaLimit, quotaPeriod, tierAndTimezone } from "@/platform/quotas";

type ProfileRow = {
  household_size: number;
  budget_cents_default: number;
  max_minutes_default: number;
  equipment: string[];
  excluded_ingredient_ids: string[];
  allergen_tags: string[];
  staple_ingredient_ids: string[];
  timezone: string;
  email_alerts: boolean;
  onboarded_at: string | null;
};

/** The profiles column defaults (init migration), for a user who has not onboarded yet. */
const DEFAULTS: Profile = {
  householdSize: 2, budgetCentsDefault: 4000, maxMinutesDefault: 30, equipment: [], excludedIngredientIds: [],
  allergenTags: [], stapleIngredientIds: [], timezone: DEFAULT_TIMEZONE, emailAlerts: false,
};

async function readRow(userId: string): Promise<ProfileRow | null> {
  const db = await reader();
  const { data, error } = await db.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw upstream("db_error", `profile lookup failed: ${error.message}`);
  return data as ProfileRow | null;
}

function fromRow(r: ProfileRow): Profile {
  return {
    householdSize: r.household_size ?? DEFAULTS.householdSize,
    budgetCentsDefault: r.budget_cents_default ?? DEFAULTS.budgetCentsDefault,
    maxMinutesDefault: r.max_minutes_default ?? DEFAULTS.maxMinutesDefault,
    equipment: r.equipment ?? [],
    excludedIngredientIds: r.excluded_ingredient_ids ?? [],
    allergenTags: r.allergen_tags ?? [],
    stapleIngredientIds: r.staple_ingredient_ids ?? [],
    timezone: r.timezone ?? DEFAULT_TIMEZONE,
    emailAlerts: r.email_alerts ?? false,
  };
}

/** The user's profile, or the defaults before onboarding (for the onboarding and settings forms). */
export async function getProfile(userId: string): Promise<Profile> {
  const row = await readRow(userId);
  return row ? fromRow(row) : { ...DEFAULTS };
}

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** ACC3: save onboarding or settings. Ingredient ids must be catalog or the user's own (else 404). */
export async function saveProfile(userId: string, profile: Profile): Promise<Profile> {
  if (!validTimezone(profile.timezone)) throw badRequest("invalid_input", "Unknown timezone");
  const ids = [...new Set([...profile.excludedIngredientIds, ...profile.stapleIngredientIds])];
  if (ids.length) {
    const db = await reader();
    const { data, error } = await db.from("ingredients").select("id").in("id", ids).or(`owner_id.is.null,owner_id.eq.${userId}`);
    if (error) throw upstream("db_error", `ingredient lookup failed: ${error.message}`);
    const visible = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
    if (ids.some((id) => !visible.has(id))) throw notFound();
  }

  const existing = await readRow(userId);
  const row = {
    household_size: profile.householdSize,
    budget_cents_default: profile.budgetCentsDefault,
    max_minutes_default: profile.maxMinutesDefault,
    equipment: profile.equipment,
    excluded_ingredient_ids: profile.excludedIngredientIds,
    allergen_tags: profile.allergenTags,
    staple_ingredient_ids: profile.stapleIngredientIds,
    timezone: profile.timezone,
    email_alerts: profile.emailAlerts,
    onboarded_at: existing?.onboarded_at ?? new Date().toISOString(),
  };
  const w = writer(userId);
  const update = () => w.db.from("profiles").update(row).eq("user_id", w.userId);
  let { error } = existing ? await update() : await w.db.from("profiles").insert({ user_id: w.userId, ...row });
  // Two first saves at once: the second insert loses the race and becomes an update.
  if (error?.code === "23505") ({ error } = await update());
  if (error) throw upstream("db_error", `saving the profile failed: ${error.message}`);
  return profile;
}

/** ACC4: who the user is, their tier, whether they finished onboarding, and every quota's use. */
export async function me(userId: string, email: string): Promise<Me> {
  const db = await reader();
  const [{ plan, tz }, row, counters] = await Promise.all([
    tierAndTimezone(userId),
    readRow(userId),
    db.from("usage_counters").select("feature, period, count").eq("user_id", userId),
  ]);
  if (counters.error) throw upstream("db_error", `usage lookup failed: ${counters.error.message}`);
  const { period, resetAt } = quotaPeriod(plan, tz);
  const rows = (counters.data ?? []) as { feature: string; period: string; count: number }[];
  const quotas = Object.fromEntries(QUOTA_FEATURES.map((feature) => [feature, {
    used: rows.find((r) => r.feature === feature && r.period === period)?.count ?? 0,
    limit: quotaLimit(feature, plan),
    resetAt,
  }]));
  return { userId, email, plan, onboarded: Boolean(row?.onboarded_at), quotas };
}

export type ProfileFormData = {
  profile: Profile;
  onboarded: boolean;
  /** Catalog and the user's own ingredients, for "never eat" and "always have". */
  ingredients: { id: string; name: string; category: string }[];
};

/** Everything the onboarding and settings forms need, read through the user's session. */
export async function profileFormData(userId: string): Promise<ProfileFormData> {
  const db = await reader();
  const [row, ing] = await Promise.all([
    readRow(userId),
    db.from("ingredients").select("id, name, category").or(`owner_id.is.null,owner_id.eq.${userId}`).order("name", { ascending: true }),
  ]);
  if (ing.error) throw upstream("db_error", `ingredient lookup failed: ${ing.error.message}`);
  return {
    profile: row ? fromRow(row) : { ...DEFAULTS },
    onboarded: Boolean(row?.onboarded_at),
    ingredients: (ing.data ?? []) as ProfileFormData["ingredients"],
  };
}
