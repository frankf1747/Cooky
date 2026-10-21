// Receipt image intake (SPEC RCT1, RCT9). The client downsizes; the server checks the type from
// the file's own bytes and the size limit from targets.json. Photos are read in memory and never
// stored (decided with Platform, 2026-10-21); removeImage only clears photos saved before that.
import targets from "@spec/targets.json";
import { writer } from "@/platform/db";
import { badRequest, tooLarge } from "@/platform/errors";
import type { ImageMediaType } from "./reader";

export const BUCKET = "receipts";

/** The media type from magic bytes; a renamed PDF or HEIC is rejected whatever its name says. */
export function sniffImage(b: Uint8Array): ImageMediaType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function parseUpload(form: FormData): Promise<{ bytes: Uint8Array; mediaType: ImageMediaType; planId: string | null }> {
  const image = form.get("image");
  if (!(image instanceof Blob) || image.size === 0) throw badRequest("invalid_input", "Attach one receipt image in the \"image\" field");
  if (form.getAll("image").length > 1) throw badRequest("invalid_input", "Upload one receipt image at a time");
  if (image.size > targets.limits.receiptImageMaxMb * 1024 * 1024) throw tooLarge();
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mediaType = sniffImage(bytes);
  if (!mediaType) throw badRequest("invalid_input", "The receipt must be a JPEG, PNG or WebP image");
  const planId = form.get("planId");
  if (planId !== null && (typeof planId !== "string" || !/^pln_[0-9a-z_]+$/.test(planId))) throw badRequest("invalid_input", "planId is not a plan id");
  return { bytes, mediaType, planId: planId || null };
}

export async function removeImage(userId: string, path: string): Promise<void> {
  const { error } = await writer(userId).db.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`receipts: deleting the image failed: ${error.message}`);
}
