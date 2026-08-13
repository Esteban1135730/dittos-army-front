import { isOwnerKey, type OwnerKey } from "../../config/owners";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * Parse `?stockIds=id1,id2,…` into unique valid Mongo ObjectId hex strings.
 */
export function parseStockIdsQuery(
  raw: string | null | undefined,
): string[] {
  if (raw == null || String(raw).trim() === "") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(",")) {
    const id = part.trim();
    if (!OBJECT_ID_RE.test(id)) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Siempre minúsculas: Mongo ObjectId hex y qr-export usan lowercase.
    out.push(key);
  }
  return out;
}

/**
 * Parse `?stockOwners=pablo,esteban` aligned to `idsLength`.
 * Missing raw → all `pablo`. Invalid keys → `pablo`.
 * If lengths differ: pad with `pablo` or truncate to `idsLength`.
 */
export function parseStockOwnersQuery(
  raw: string | null | undefined,
  idsLength: number,
): OwnerKey[] {
  if (idsLength <= 0) return [];
  if (raw == null || String(raw).trim() === "") {
    return Array.from({ length: idsLength }, () => "pablo");
  }
  const parts = String(raw)
    .split(",")
    .map((part) => {
      const key = part.trim().toLowerCase();
      return isOwnerKey(key) ? key : "pablo";
    });
  if (parts.length < idsLength) {
    return [
      ...parts,
      ...Array.from({ length: idsLength - parts.length }, () => "pablo" as const),
    ];
  }
  return parts.slice(0, idsLength);
}
