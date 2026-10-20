// Money is integer cents everywhere. An unknown price is null and is never shown or summed as zero.

export function formatUsd(cents: number | null): string {
  if (cents === null) return "price unknown";
  return `$${(cents / 100).toFixed(2)}`;
}

export function sumCents(values: (number | null)[]): { total: number; unknownCount: number } {
  let total = 0;
  let unknownCount = 0;
  for (const v of values) {
    if (v === null) unknownCount++;
    else if (!Number.isInteger(v)) throw new Error(`sumCents: ${v} is not integer cents`);
    else total += v;
  }
  return { total, unknownCount };
}
