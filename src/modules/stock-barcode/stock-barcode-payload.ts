/** Alineado con `dittos-army-back/src/utils/stock-barcode-payload.ts` */
export const STOCK_BARCODE_PREFIX = "DA-STOCK:";

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function parseStockBarcodePayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(STOCK_BARCODE_PREFIX)) {
    const id = trimmed.slice(STOCK_BARCODE_PREFIX.length).trim();
    return OBJECT_ID_RE.test(id) ? id : null;
  }
  return OBJECT_ID_RE.test(trimmed) ? trimmed : null;
}

/** @deprecated */
export const parseStockQrPayload = parseStockBarcodePayload;
