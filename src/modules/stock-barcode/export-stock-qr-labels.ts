import QRCode from "qrcode";
import type { StockQrExportRow } from "./types";
import { formatCOP } from "../../utils/convert";

/**
 * Ventana imprimible con código QR por línea (pistola QR o cámara).
 */
export async function openStockQrLabelsPrintWindow(
  rows: StockQrExportRow[],
): Promise<void> {
  if (rows.length === 0) {
    throw new Error("No hay líneas de stock para exportar.");
  }

  const cards = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      svg: await QRCode.toString(row.qr_value, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        width: 150,
      }),
    })),
  );

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>QR — stock</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      margin: 20px;
      color: #1a1a2e;
      background: #f8fafc;
    }
    h1 { font-size: 1.25rem; margin: 0 0 4px; font-weight: 700; }
    .subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 20px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 10px;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }
    .card svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    .name {
      font-size: 12px;
      font-weight: 700;
      margin-top: 8px;
      line-height: 1.25;
      min-height: 2.5em;
    }
    .meta {
      font-size: 10px;
      color: #475569;
      margin-top: 6px;
      line-height: 1.4;
    }
    .meta-row { margin-top: 2px; }
    .tag {
      display: inline-block;
      background: #f1f5f9;
      border-radius: 4px;
      padding: 1px 5px;
      margin: 2px 2px 0 0;
      font-size: 9px;
      font-weight: 600;
      color: #334155;
    }
    .pvp {
      font-size: 13px;
      font-weight: 800;
      color: #0d47a1;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #cbd5e1;
    }
    @media print {
      body { margin: 8px; background: #fff; }
      .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <h1>Etiquetas QR — stock</h1>
  <p class="subtitle">${cards.length} líneas · Venta asistida QR en el panel</p>
  <div class="grid">
    ${cards
      .map((c) => {
        const tags = [
          c.rareza ? `<span class="tag">${escapeHtml(c.rareza)}</span>` : "",
          c.language ? `<span class="tag">${escapeHtml(c.language)}</span>` : "",
        ]
          .filter(Boolean)
          .join("");
        return `
    <div class="card">
      ${c.svg}
      <div class="name">${escapeHtml(c.card_name || "Sin nombre")}</div>
      <div class="meta">
        ${c.expansion ? `<div class="meta-row">${escapeHtml(c.expansion)}</div>` : ""}
        ${tags ? `<div class="meta-row">${tags}</div>` : ""}
      </div>
      <div class="pvp">COP ${escapeHtml(formatCOP(c.price_cop))}</div>
    </div>`;
      })
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
