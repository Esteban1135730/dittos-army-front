import type { StockQrExportRow } from "./types";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { formatCOP } from "../../utils/convert";

export type QrLabelsPrintOptions = {
  /** Texto bajo el título (p. ej. filtros activos). */
  subtitle?: string;
};

/** Hoja A4: 5×12 (60) — equilibrio entre densidad y legibilidad del QR. */
const COLS = 5;
const ROWS = 12;

export const QR_LABELS_COLS = COLS;
export const QR_LABELS_ROWS = ROWS;
export const QR_LABELS_PER_PAGE = COLS * ROWS;

async function loadQrCode() {
  return (await import("qrcode")).default;
}

/** Una línea corta para etiqueta pequeña. */
function shortCardName(name: string, max = 24): string {
  const t = name.trim() || "Sin nombre";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Expansión e idioma en una sola línea para la etiqueta. */
export function formatQrLabelMetaLine(
  expansion: string,
  language: string,
  max = 26,
): string {
  const parts: string[] = [];
  const exp = expansion.trim();
  const lang = language.trim();
  if (exp) parts.push(exp);
  if (lang && lang !== "—") parts.push(lang);
  if (parts.length === 0) return "";
  const line = parts.join(" · ");
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

function renderQrLabelMetaHtml(expansion: string, language: string): string {
  const meta = formatQrLabelMetaLine(expansion, language);
  if (!meta) return "";
  const full = [expansion, language]
    .filter((p) => p.trim() && p.trim() !== "—")
    .join(" · ");
  return `<div class="meta" title="${escapeHtml(full)}">${escapeHtml(meta)}</div>`;
}

/**
 * Hoja A4 5×12 — QR + nombre + expansión/idioma + PVP, guías de corte punteadas.
 */
export async function openStockQrLabelsPrintWindow(
  rows: StockQrExportRow[],
  options?: QrLabelsPrintOptions,
): Promise<void> {
  if (rows.length === 0) {
    throw new Error("No hay líneas de stock para exportar.");
  }

  const QRCode = await loadQrCode();
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
    `${cards.length} etiquetas · hoja A4 adhesiva (${COLS}×${ROWS})`;

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
      width: 210mm;
      min-height: 297mm;
      background: #fff;
      padding: 4mm 3mm;
      display: grid;
      grid-template-columns: repeat(${COLS}, 40.8mm);
      grid-auto-rows: 24.08mm;
      gap: 0;
      align-content: start;
    }
    .label {
      width: 40.8mm;
      height: 24.08mm;
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
      padding: 1.2mm 1.5mm;
      gap: 0.5px;
      text-align: center;
    }
    .qr {
      flex: 0 0 auto;
      width: 12.5mm;
      height: 12.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr svg { width: 100% !important; height: 100% !important; display: block; }
    .info {
      width: 100%;
      min-width: 0;
      line-height: 1.05;
    }
    .name {
      font-size: 5pt;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .meta {
      font-size: 4.5pt;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .pvp {
      font-size: 6pt;
      font-weight: 800;
      color: #0d47a1;
      white-space: nowrap;
    }
    @media print {
      @page { size: A4; margin: 0; }
      body { background: #fff; }
      .no-print { display: none !important; }
      .sheet-wrap { padding: 0; }
      .sheet { padding: 4mm 3mm; }
      .label { border-color: #aaa; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h1>Etiquetas QR — stock</h1>
    <p>${escapeHtml(subtitle)}</p>
    <ul>
      <li>Hoja A4: ${COLS} columnas × ${ROWS} filas (hasta ${COLS * ROWS} por página).</li>
      <li>En el diálogo de impresión elige papel <strong>A4</strong> y márgenes ninguno / mínimo.</li>
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
            ${renderQrLabelMetaHtml(c.expansion, c.language)}
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

/**
 * Rollo adhesivo 50×30 mm (632-L58P).
 * Constantes editables si el rollo físico cambia.
 */
export const THERMAL_QR_LABEL_WIDTH_MM = 50;
export const THERMAL_QR_LABEL_HEIGHT_MM = 30;

/**
 * Una etiqueta = una página CSS; un solo `window.print()`.
 * Layout horizontal: QR grande a la izquierda, datos a la derecha.
 */
export async function openStockQrLabelsThermalPrintWindow(
  rows: StockQrExportRow[],
  options?: QrLabelsPrintOptions,
): Promise<void> {
  if (rows.length === 0) {
    throw new Error("No hay líneas de stock para exportar.");
  }

  const W = THERMAL_QR_LABEL_WIDTH_MM;
  const H = THERMAL_QR_LABEL_HEIGHT_MM;
  /** QR compacto: deja ancho al texto; alto 30 mm. */
  const qrMm = 20;

  const QRCode = await loadQrCode();
  const cards = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      svg: await QRCode.toString(row.qr_value, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 0,
        width: 256,
      }),
    })),
  );

  const subtitle =
    options?.subtitle ??
    `${cards.length} etiqueta${cards.length === 1 ? "" : "s"} · térmica ${W}×${H} mm`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>QR — térmica ${W}×${H}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${W}mm;
      margin: 0;
      padding: 0;
      font-family: Arial Black, Arial, "Segoe UI", sans-serif;
      color: #000;
      background: #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      width: auto;
      max-width: 420px;
      padding: 12px 16px;
      background: #1e293b;
      color: #f8fafc;
      font-family: Arial, "Segoe UI", sans-serif;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .no-print h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .no-print p { opacity: 0.9; line-height: 1.4; }
    .no-print ul { margin: 8px 0 0 18px; font-size: 12px; opacity: 0.85; }
    .label {
      width: ${W}mm;
      height: ${H}mm;
      background: #fff;
      overflow: hidden;
      border: 1px dashed #94a3b8;
    }
    .label-inner {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      width: ${W}mm;
      height: ${H}mm;
      padding: 0.8mm 1mm;
      gap: 1.2mm;
    }
    .qr {
      flex: 0 0 ${qrMm}mm;
      width: ${qrMm}mm;
      height: ${qrMm}mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr svg {
      width: ${qrMm}mm !important;
      height: ${qrMm}mm !important;
      display: block;
    }
    .info {
      flex: 1 1 auto;
      min-width: 0;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      text-align: left;
      gap: 0.3mm;
      line-height: 1.12;
      overflow: hidden;
      color: #000;
    }
    /* Tipografía más gruesa: térmica 203 dpi pierde trazo fino */
    .name {
      font-size: 7pt;
      font-weight: 900;
      letter-spacing: 0.01em;
      -webkit-text-stroke: 0.25px #000;
      paint-order: stroke fill;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      max-width: 100%;
    }
    .meta {
      font-size: 6pt;
      font-weight: 800;
      letter-spacing: 0.01em;
      -webkit-text-stroke: 0.2px #000;
      paint-order: stroke fill;
      color: #000;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      max-width: 100%;
    }
    .pvp {
      font-size: 7.5pt;
      font-weight: 900;
      letter-spacing: 0.02em;
      -webkit-text-stroke: 0.3px #000;
      paint-order: stroke fill;
      color: #000;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    @page {
      size: ${W}mm ${H}mm;
      margin: 0;
    }
    @media print {
      html, body {
        width: ${W}mm;
        height: auto;
        background: #fff;
        margin: 0;
        padding: 0;
        color: #000;
      }
      .no-print { display: none !important; }
      .label {
        border: none;
        width: ${W}mm;
        height: ${H}mm;
        margin: 0;
        padding: 0;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .label:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .label-inner {
        padding: 0.8mm 1mm;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h1>Etiquetas QR — térmica 632-L58P</h1>
    <p>${escapeHtml(subtitle)}</p>
    <ul>
      <li>Tamaño: <strong>${W}×${H} mm</strong> — papel ${W}×${H}, márgenes <strong>ninguno</strong>, escala <strong>100%</strong>.</li>
      <li>Layout: QR (${qrMm} mm) a la izquierda; texto en negrita con saltos de línea a la derecha.</li>
      <li>Impresora: <strong>632-L58P</strong>. Una página por etiqueta.</li>
    </ul>
  </div>
    ${cards
      .map((c) => {
        const name = (c.card_name || "").trim() || "Sin nombre";
        const exp = (c.expansion || "").trim();
        const lang = (c.language || "").trim();
        const rz = (c.rareza || "").trim();
        const metaParts: string[] = [];
        if (exp) metaParts.push(exp);
        if (lang && lang !== "—") metaParts.push(lang);
        if (rz) metaParts.push(operationalRarezaLabel(rz));
        return `
      <div class="label">
        <div class="label-inner">
          <div class="qr">${c.svg}</div>
          <div class="info">
            <div class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            ${metaParts
              .map(
                (part) =>
                  `<div class="meta">${escapeHtml(part)}</div>`,
              )
              .join("")}
            <div class="pvp">COP ${escapeHtml(formatCOP(c.price_cop))}</div>
          </div>
        </div>
      </div>`;
      })
      .join("")}
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
