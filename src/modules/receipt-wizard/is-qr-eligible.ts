/**
 * A stock line is QR-eligible when its id appears in qr-export rows.
 * Compara en minúsculas (ObjectId hex / URLs pueden variar en casing).
 */
export function isQrEligible(
  stockId: string,
  eligibleIds: ReadonlySet<string>,
): boolean {
  const key = String(stockId ?? "").trim().toLowerCase();
  if (!key) return false;
  if (eligibleIds.has(key)) return true;
  // Por si el Set se construyó sin normalizar.
  if (eligibleIds.has(stockId)) return true;
  return false;
}
