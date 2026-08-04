import type { StockQrExportRow } from "./types";

/** Columnas para importar en OpenLabel+ (Excel/CSV → campos de plantilla / QR). */
export const OPENLABEL_CSV_COLUMNS = [
  "qr_value",
  "card_name",
  "expansion",
  "language",
  "rareza",
  "price_cop",
  "stock_id",
] as const;

export type OpenLabelCsvColumn = (typeof OPENLABEL_CSV_COLUMNS)[number];

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cellForColumn(
  row: StockQrExportRow,
  column: OpenLabelCsvColumn,
): string {
  switch (column) {
    case "qr_value":
      return row.qr_value;
    case "card_name":
      return row.card_name ?? "";
    case "expansion":
      return row.expansion ?? "";
    case "language":
      return row.language ?? "";
    case "rareza":
      return row.rareza ?? "";
    case "price_cop":
      return String(row.price_cop ?? "");
    case "stock_id":
      return row.stock_id;
    default: {
      const _exhaustive: never = column;
      return _exhaustive;
    }
  }
}

/**
 * CSV UTF-8 (BOM) para OpenLabel+: una fila por etiqueta.
 * En la app, enlaza el QR a `qr_value` y textos a las demás columnas.
 */
export function buildOpenLabelQrLabelsCsv(rows: StockQrExportRow[]): string {
  if (rows.length === 0) {
    throw new Error("No hay etiquetas para exportar a OpenLabel+.");
  }

  const header = OPENLABEL_CSV_COLUMNS.join(",");
  const body = rows
    .map((row) =>
      OPENLABEL_CSV_COLUMNS.map((col) =>
        escapeCsvCell(cellForColumn(row, col)),
      ).join(","),
    )
    .join("\r\n");

  // BOM ayuda a Excel / OpenLabel+ a detectar UTF-8 en Windows.
  return `\uFEFF${header}\r\n${body}\r\n`;
}

export function downloadOpenLabelQrLabelsCsv(
  rows: StockQrExportRow[],
  filename = "etiquetas-qr-openlabel.csv",
): void {
  const csv = buildOpenLabelQrLabelsCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
