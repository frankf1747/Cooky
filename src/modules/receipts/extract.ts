// One receipt image → classified lines (SPEC RCT2–RCT4): one receipt_reader run through the
// gateway, then code converts and decides every line. Shared by the app (index.ts) and the eval
// (eval-run.ts) so the eval measures exactly what users get. No storage, no receipt rows.
import { ReceiptExtraction, type ReceiptLine, type RunInfo } from "@spec/contract";
import { runAi } from "@/platform/ai";
import { newId } from "@/platform/ids";
import { classifyLine, type CatalogIngredient, type LineCatalog } from "./lines";
import { legibleDate, receiptContent, receiptSystem, validateExtraction, type ImageMediaType } from "./reader";

export type Extracted = {
  isReceipt: boolean;
  store: string | null;
  purchasedOn: string | null;
  lines: ReceiptLine[];
  run: RunInfo;
};

export async function extractReceipt(args: {
  userId: string;
  requestId: string;
  image: Uint8Array;
  mediaType: ImageMediaType;
  catalog: LineCatalog & { list: (CatalogIngredient & { aliases: string[] })[] };
  today: string;
}): Promise<Extracted> {
  const ids = new Set(args.catalog.ingredients.keys());
  const { output, run } = await runAi({
    unit: "receipt_reader",
    userId: args.userId,
    requestId: args.requestId,
    schema: ReceiptExtraction,
    system: receiptSystem(args.catalog.list),
    content: receiptContent(args.image, args.mediaType),
    validate: (out) => validateExtraction(out, ids),
  });
  if (!output.isReceipt) return { isReceipt: false, store: null, purchasedOn: null, lines: [], run };
  const purchasedOn = legibleDate(output.purchasedOn);
  const dates = { purchasedOn, today: args.today };
  return {
    isReceipt: true,
    store: output.store,
    purchasedOn,
    lines: output.lines.map((l) => ({ lineId: newId("rln"), ...classifyLine(l, args.catalog, dates) })),
    run,
  };
}
