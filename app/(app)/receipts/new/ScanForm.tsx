"use client";
// Owner: Receipts. Photo → downsized JPEG → POST /api/receipts → the review screen (RCT1, RCT7).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { receiptErrorMessage, type ApiErrorBody, type ReceiptError } from "../ui";

/**
 * Re-encodes the photo as a JPEG no longer than maxPx on its long edge. This also drops the
 * photo's metadata (location, device), which the server never needs.
 */
async function downsize(file: File, maxPx: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("encode failed"))), "image/jpeg", 0.85));
}

export function ScanForm({ maxPx, maxMb, planId }: { maxPx: number; maxMb: number; planId: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReceiptError | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pick(f: File | null) {
    setError(null);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      let image: Blob;
      try {
        image = await downsize(file, maxPx);
      } catch {
        return setError({ message: "Cooky couldn't open that photo. Try a JPEG, PNG or WebP image.", retry: false });
      }
      if (image.size > maxMb * 1024 * 1024) return setError(receiptErrorMessage(413, { code: "too_large" }));
      const form = new FormData();
      form.set("image", image, "receipt.jpg");
      if (planId) form.set("planId", planId);
      const res = await fetch("/api/receipts", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(receiptErrorMessage(res.status, body as ApiErrorBody));
      router.push(`/receipts/${body.receipt.receiptId}`);
    } catch {
      setError(receiptErrorMessage(0, {}));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center hover:border-zinc-400 dark:border-zinc-700">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
          <img src={preview} alt="Your receipt photo" className="max-h-80 rounded-md object-contain" />
        ) : (
          <span className="text-zinc-600 dark:text-zinc-400">Tap to take a photo or choose one</span>
        )}
        <span className="text-sm text-zinc-500">{file ? "Tap to choose a different photo" : "JPEG, PNG or WebP"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>

      {planId && <p className="text-sm text-zinc-500">Cooky will compare this receipt with your plan.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={upload}
          disabled={!file || busy}
          className="rounded-md bg-zinc-900 px-5 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Reading your receipt…" : error?.retry ? "Try again" : "Read receipt"}
        </button>
        {busy && <span className="text-sm text-zinc-500" aria-live="polite">This can take up to half a minute.</span>}
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p>{error.message}</p>
          {error.manualAdd && (
            <Link href="/fridge" className="mt-1 inline-block font-medium underline">Add groceries by hand</Link>
          )}
        </div>
      )}
    </div>
  );
}
