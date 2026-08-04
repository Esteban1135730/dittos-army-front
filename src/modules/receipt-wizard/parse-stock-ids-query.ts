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
    out.push(id);
  }
  return out;
}
