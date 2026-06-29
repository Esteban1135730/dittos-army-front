import type { StockQrExportRow } from "../stock-barcode";
import type { PrintQueueEntry } from "./types";

export type ExpandQueueResult = {
  rows: StockQrExportRow[];
  omittedCount: number;
};

export function expandQueueToExportRows(
  queue: PrintQueueEntry[],
  exportByStockId: Map<string, StockQrExportRow>,
): ExpandQueueResult {
  const rows: StockQrExportRow[] = [];
  let requested = 0;

  for (const entry of queue) {
    const row = exportByStockId.get(entry.stockId);
    requested += entry.quantity;
    if (!row) continue;
    for (let i = 0; i < entry.quantity; i++) {
      rows.push(row);
    }
  }

  return {
    rows,
    omittedCount: requested - rows.length,
  };
}
