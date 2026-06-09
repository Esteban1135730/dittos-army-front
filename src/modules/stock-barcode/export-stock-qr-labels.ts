import QRCode from "qrcode";
import type { StockQrExportRow } from "./types";
import { formatCOP } from "../../utils/convert";

export type QrLabelsPrintOptions = {
  /** Texto bajo el título (p. ej. filtros activos). */
  subtitle?: string;
};

const COLS = 4;
const ROWS = 12;

/** Una línea corta para etiqueta pequeña. */
function shortCardName(name: string, max = 32): string {
  const t = name.trim() || "Sin nombre";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Hoja carta (letter) 4×12 — QR + nombre + PVP, guías de corte punteadas.
 */
export async function openStockQrLabelsPrintWindow(
  rows: StockQrExportRow[],
  options?: QrLabelsPrintOptions,
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
        width: 52,
      }),
    })),
  );

  const subtitle =
    options?.subtitle ??
    `${cards.length} etiquetas · hoja carta adhesiva (${COLS}×${ROWS})`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>QR — stock</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, "Segoe UI", sans-serif;
      color: #111;
      background: #e2e8f0;
    }
    .no-print {
      padding: 12px 16px;
      background: #1e293b;
      color: #f8fafc;
      font-size: 13px;
    }
    .no-print h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .no-print p { opacity: 0.9; line-height: 1.4; }
    .no-print ul { margin: 8px 0 0 18px; font-size: 12px; opacity: 0.85; }
    .sheet-wrap { padding: 8px; display: flex; justify-content: center; }
    .sheet {
      width: 8.5in;
      min-height: 11in;
      background: #fff;
      padding: 0.12in 0.08in;
      display: grid;
      grid-template-columns: repeat(${COLS}, 2.08in);
      grid-auto-rows: 0.86in;
      gap: 0;
      align-content: start;
    }
    .label {
      width: 2.08in;
      height: 0.86in;
      border: 1px dashed #94a3b8;
      position: relative;
      overflow: hidden;
      page-break-inside: avoid;
      background: #fff;
    }
    .label-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      /* Zona segura: aleja QR y texto del borde de corte */
      padding: 0.06in 0.08in;
      gap: 1px;
      text-align: center;
    }
    .qr {
      flex: 0 0 auto;
      width: 0.5in;
      height: 0.5in;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr svg { width: 100% !important; height: 100% !important; display: block; }
    .info {
      width: 100%;
      min-width: 0;
      line-height: 1.1;
    }
    .name {
      font-size: 5.5pt;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .pvp {
      font-size: 6.5pt;
      font-weight: 800;
      color: #0d47a1;
      white-space: nowrap;
    }
    @media print {
      @page { size: letter; margin: 0; }
      body { background: #fff; }
      .no-print { display: none !important; }
      .sheet-wrap { padding: 0; }
      .sheet { padding: 0.12in 0.08in; }
      .label { border-color: #aaa; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h1>Etiquetas QR — stock</h1>
    <p>${escapeHtml(subtitle)}</p>
    <ul>
      <li>Hoja carta: ${COLS} columnas × ${ROWS} filas (hasta ${COLS * ROWS} por página).</li>
      <li>QR centrado con margen interno (zona segura) lejos del borde de corte.</li>
    </ul>
  </div>
  <div class="sheet-wrap">
    <div class="sheet">
    ${cards
      .map(
        (c) => `
      <div class="label">
        <div class="label-inner">
          <div class="qr">${c.svg}</div>
          <div class="info">
            <div class="name" title="${escapeHtml(c.card_name || "")}">${escapeHtml(shortCardName(c.card_name || ""))}</div>
            <div class="pvp">COP ${escapeHtml(formatCOP(c.price_cop))}</div>
          </div>
        </div>
      </div>`,
      )
      .join("")}
    </div>
  </div>
  <script>window.onload = () => { setTimeout(() => window.print(), 500); };</script>
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
