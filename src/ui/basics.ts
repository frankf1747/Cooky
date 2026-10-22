// Owner: Platform. The steps for the basics every plan starts from, shared by the plan form and
// Settings, so both offer the same budgets and times. These are choices of the controls, not
// targets: the API accepts any budget and time.
import { formatUsd } from "@/platform/money";

/** The budget steps by $5, from $5 up to $300 a week. */
export const BUDGET_STEP_CENTS = 500;
export const BUDGET_MIN_CENTS = 500;
export const BUDGET_MAX_CENTS = 30000;
/** Cooking times on offer, in minutes per dish. */
export const MINUTE_CHOICES = [15, 20, 30, 45, 60];

/** The times to show: the standard ones plus the one in force, if it is not one of them. */
export const minuteChoices = (current: number) => [...new Set([...MINUTE_CHOICES, current])].sort((a, b) => a - b);

/** $40, or $37.50 when there are cents. */
export const usd = (cents: number) => (cents % 100 ? formatUsd(cents) : `$${cents / 100}`);
