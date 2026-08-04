/**
 * A stock line is QR-eligible when its id appears in qr-export rows.
 */
export function isQrEligible(
  stockId: string,
  eligibleIds: ReadonlySet<string>,
): boolean {
  return eligibleIds.has(stockId);
}
