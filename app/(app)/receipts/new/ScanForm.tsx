"use client";
// Owner: Receipts. Photo → downsized JPEG → POST /api/receipts → the review screen (RCT1, RCT7).
// The main action is a camera button: taking the photo starts reading it, no second tap. Choosing
// a photo from the library does the same. A failed read keeps the photo for "Try again".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowClockwise, Camera, Images } from "@phosphor-icons/react";
import { Bao, BaoSays } from "@/ui/Bao";
import { alert, btnPrimary, btnSecondary, btnText, field, label } from "@/ui/styles";
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

  async function upload(photo: File | null = file) {
    if (!photo || busy) return;
    setBusy(true);
    setError(null);
    try {
      let image: Blob;
      try {
        image = await downsize(photo, maxPx);
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

  /** Taking or choosing a photo reads it straight away. */
  function took(f: File | null) {
    if (!f) return;
    pick(f);
    void upload(f);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="receipt-edge flex min-h-52 flex-col items-center justify-center gap-2.5 rounded-t-3xl bg-parchment px-6 pb-12 pt-6 text-center text-parchment-ink sm:min-h-64 sm:pt-8">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
          <img src={preview} alt="Your receipt photo" className={`pop-in max-h-80 rounded-xl object-contain shadow-float transition ${busy ? "opacity-70" : ""}`} />
        ) : (
          <>
            <Bao mood="curious" pose="hold" prop="receipt" size={96} decorative />
            <span className="font-display text-2xl font-semibold tracking-[-0.01em] text-foreground">Snap the whole receipt</span>
            <span className="text-sm">Flat, in good light, top to bottom in the frame.</span>
          </>
        )}
      </div>

      {plans.length > 0 && (
        <label className={label}>
          Compare with a plan
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={busy} className={field}>
            <option value="">Don&apos;t compare</option>
            {plans.map((p) => <option key={p.planId} value={p.planId}>{p.label}</option>)}
          </select>
          <span className="font-normal text-muted">Cooky shows what the plan needed that isn&apos;t on the receipt.</span>
        </label>
      )}

      {busy ? (
        <BaoSays mood="thinking" pose="hold" prop="receipt" motion="breathe" size={60}>Reading it now. Squinting at the tax line. Up to half a minute.</BaoSays>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* the camera button: on a phone it opens the camera; the photo is read as soon as it's taken */}
          <label className={`${btnPrimary} !h-16 w-full cursor-pointer !text-base has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 sm:w-auto sm:!px-10`}>
            <Camera size={24} weight="fill" aria-hidden />
            {file ? "Take another photo" : "Take a photo"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { took(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <label className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] has-[:focus-visible]:underline ${btnText}`}>
              <Images size={18} aria-hidden />
              Choose from your photos
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { took(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            {file && error?.retry && (
              <button type="button" onClick={() => upload()} className={`${btnSecondary} !h-11`}>
                <ArrowClockwise size={18} aria-hidden />
                Read this photo again
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className={alert}>
          <p>{error.message}</p>
          {error.manualAdd && (
            <Link href="/fridge" className={`mt-1.5 inline-block ${btnText}`}>Add groceries by hand</Link>
          )}
        </div>
      )}
    </div>
  );
}
