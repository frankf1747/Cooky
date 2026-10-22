"use client";
// Owner: Receipts. Photo → downsized JPEG → POST /api/receipts → the review screen (RCT1, RCT7).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bao, BaoSays } from "@/ui/Bao";
import { alert, btnPrimary, btnText, field } from "@/ui/styles";
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

type PlanOption = { planId: string; label: string };

export function ScanForm({ maxPx, maxMb, plans, initialPlanId }: { maxPx: number; maxMb: number; plans: PlanOption[]; initialPlanId: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [planId, setPlanId] = useState(initialPlanId ?? "");
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
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-tile-tangerine p-6 text-center transition hover:-translate-y-0.5 active:scale-[0.99]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
          <img src={preview} alt="Your receipt photo" className="max-h-80 rounded-md object-contain" />
        ) : (
          <>
            <Bao mood="look" pose="hold" prop="receipt" motion="bob" size={64} decorative />
            <span className="font-display text-lg font-semibold tracking-tight">Tap to take a photo</span>
          </>
        )}
        <span className="text-sm text-zinc-500">{file ? "Tap to choose a different photo" : "Or choose one. JPEG, PNG or WebP."}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>

      {plans.length > 0 && (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Compare with a plan</span>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={busy} className={field}>
            <option value="">Don&apos;t compare</option>
            {plans.map((p) => <option key={p.planId} value={p.planId}>{p.label}</option>)}
          </select>
          <span className="text-zinc-500">Cooky shows what the plan needed that isn&apos;t on the receipt.</span>
        </label>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          onClick={upload}
          disabled={!file || busy}
          className={btnPrimary}
        >
          {busy ? "Reading your receipt…" : error?.retry ? "Try again" : "Read receipt"}
        </button>
        {busy && <BaoSays mood="thinking" pose="hold" prop="receipt" motion="bob" size={44}>Reading it now. Squinting at the tax line. Up to half a minute.</BaoSays>}
      </div>

      {error && (
        <div role="alert" className={alert}>
          <p>{error.message}</p>
          {error.manualAdd && (
            <Link href="/fridge" className={`mt-1 inline-block ${btnText}`}>Add groceries by hand</Link>
          )}
        </div>
      )}
    </div>
  );
}
