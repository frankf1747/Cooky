// Prefixed, time-sortable ids: `itm_` + 10 chars of time + 16 random chars (Crockford base32).
import type { IdPrefix } from "@spec/contract";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function newId(prefix: IdPrefix): string {
  let time = Date.now();
  let head = "";
  for (let i = 0; i < 10; i++) {
    head = ALPHABET[time % 32] + head;
    time = Math.floor(time / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let tail = "";
  for (const b of bytes) tail += ALPHABET[b % 32];
  return `${prefix}_${head}${tail}`;
}
