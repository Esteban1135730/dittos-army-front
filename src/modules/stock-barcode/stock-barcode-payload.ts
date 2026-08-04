import type { OwnerKey } from "../../config/owners";
import { OWNERS_CONFIG } from "../../config/owners";

/** Prefijo legacy Pablo. */
export const STOCK_QR_PREFIX = OWNERS_CONFIG.owners.pablo.stockQrPrefix;

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export type ParsedStockQr = {
  stockId: string;
  owner: OwnerKey | null;
  prefixUsed?: string;
};

function loosePrefixRe(prefix: string): RegExp {
  const body = prefix.replace(/:$/, "");
  const escaped = body
    .replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
    .replace(/-/g, "[-_']?");
  return new RegExp(`${escaped}[:\\u00D1;]?([a-f0-9]{24})`, "i");
}

const PREFIX_ENTRIES = Object.values(OWNERS_CONFIG.owners).map((o) => ({
  owner: o.key,
  prefix: o.stockQrPrefix,
  loose: loosePrefixRe(o.stockQrPrefix),
}));

function normalizeQrWedgeInput(raw: string): string {
  return raw.trim().replace(/Ñ/g, ":").replace(/[''´`]/g, "-");
}

export function parseStockQrPayloadMulti(raw: string): ParsedStockQr | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = normalizeQrWedgeInput(trimmed);

  for (const entry of PREFIX_ENTRIES) {
    if (normalized.toUpperCase().startsWith(entry.prefix.toUpperCase())) {
      const id = normalized.slice(entry.prefix.length).trim();
      if (!OBJECT_ID_RE.test(id)) return null;
      return { stockId: id, owner: entry.owner, prefixUsed: entry.prefix };
    }
  }

  for (const entry of PREFIX_ENTRIES) {
    const loose =
      entry.loose.exec(trimmed) ?? entry.loose.exec(normalized);
    if (loose?.[1] && OBJECT_ID_RE.test(loose[1])) {
      return {
        stockId: loose[1],
        owner: entry.owner,
        prefixUsed: entry.prefix,
      };
    }
  }

  if (OBJECT_ID_RE.test(trimmed)) {
    return { stockId: trimmed, owner: null };
  }

  return null;
}

export function parseStockQrPayload(raw: string): string | null {
  return parseStockQrPayloadMulti(raw)?.stockId ?? null;
}

/** @deprecated Usar STOCK_QR_PREFIX */
export const STOCK_BARCODE_PREFIX = STOCK_QR_PREFIX;

/** @deprecated Usar parseStockQrPayload */
export const parseStockBarcodePayload = parseStockQrPayload;
