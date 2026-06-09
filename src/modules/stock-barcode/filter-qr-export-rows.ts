import type { StockQrExportRow } from "./types";

/** Deja solo filas cuyo stock_id está en el conjunto (p. ej. grilla filtrada). */
export function filterQrExportRowsByStockIds(
  rows: StockQrExportRow[],
  stockIds: Iterable<string>,
): StockQrExportRow[] {
  const allowed = new Set(stockIds);
  return rows.filter((r) => allowed.has(r.stock_id));
}
