import type { StockBarcodeExportRow } from "./types";
import { renderCode128Svg } from "./render-code128-svg";

/**
 * Ventana imprimible con código de barras Code 128 por línea (pistola láser).
 */
export function openStockBarcodeLabelsPrintWindow(
  rows: StockBarcodeExportRow[],
): void {
  if (rows.length === 0) {
    throw new Error("No hay líneas de stock para exportar.");
  }

  const cards = rows.map((row) => ({
    ...row,
    svg: renderCode128Svg(row.barcode_value),
  }));

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Códigos de barras — stock</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { border: 1px solid #ccc; padding: 12px; text-align: center; page-break-inside: avoid; }
    .card svg { max-width: 100%; height: auto; }
    .name { font-size: 13px; font-weight: 600; margin-top: 8px; }
    .id { font-size: 10px; color: #555; word-break: break-all; margin-top: 4px; }
    @media print { body { margin: 8px; } }
  </style>
</head>
<body>
  <h1>Etiquetas Code 128 — stock</h1>
  <p>${cards.length} líneas. Escanea con pistola láser o «Escanear código de barras» en el panel.</p>
  <div class="grid">
    ${cards
      .map(
        (c) => `
    <div class="card">
      ${c.svg}
      <div class="name">${escapeHtml(c.card_name || "Sin nombre")}</div>
      <div class="id">${escapeHtml(c.stock_id)}</div>
    </div>`,
      )
      .join("")}
  </div>
  <script>window.onload = () => { setTimeout(() => window.print(), 400); };</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    throw new Error(
      "El navegador bloqueó la ventana emergente. Permite pop-ups e inténtalo de nuevo.",
    );
  }
  win.document.write(html);
  win.document.close();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
