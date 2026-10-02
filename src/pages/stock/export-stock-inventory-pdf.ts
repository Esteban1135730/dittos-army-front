import type { jsPDF } from "jspdf";
import { loadJsPdf } from "../../utils/pdf-libs";
import { mapWithConcurrency } from "../../utils/concurrency";
import lockupUrl from "../pdf-grupos/el-nido-tcg-lockup.png";
import {
  buildGruposPdfFooterContacts,
  formatGruposPdfDate,
  GRUPOS_PDF_BG,
  GRUPOS_PDF_CHIP_BG,
  GRUPOS_PDF_FORMAT,
  GRUPOS_PDF_GOLD,
  GRUPOS_PDF_PAGE_MM,
  GRUPOS_PDF_TEXT,
  GRUPOS_PDF_WEB_URL,
  readBlobAsDataUrl,
} from "../pdf-grupos/pdf-grupos";
import type { OwnerKey } from "../../config/owners";
import type { StockListItem } from "../../types/stock";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { formatCOP } from "../../utils/convert";
import {
  fetchInventoryPhotoDataUrl,
  rewriteStockPhotoUrl,
} from "../../utils/stock-photo-url";

export type StockInventoryPdfRow = {
  _id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language?: string;
  rareza?: string | null;
  pvp?: number;
  pvp_currency?: string;
  card_state: string;
};

const SELLABLE = new Set(["disponible", "en_stock_colombia"]);

/** Proporción carta Pokémon (63 × 88 mm) — coincide con el recorte del editor. */
export const CARD_ASPECT_RATIO = 63 / 88;

/** Cuántas cartas caben por hoja en la grilla del PDF (3 columnas). */
export function computeInventoryPdfGridLayout(): {
  cols: number;
  rowsPerPage: number;
  cardsPerPage: number;
} {
  const contentTop = LOGO_BAND_MM + 5;
  const contentBottom = PAGE_H - FOOTER_BAND_MM - 2;
  const cellW = (PAGE_W - MARGIN_MM * 2 - COL_GAP_MM * (COLS - 1)) / COLS;
  const imgW = Math.min(IMG_W_MM, cellW - 2);
  const imgH = imgW / CARD_ASPECT_RATIO;
  const cellH = imgH + TEXT_BLOCK_MM;
  const rowsPerPage = Math.max(
    1,
    Math.floor((contentBottom - contentTop + ROW_GAP_MM) / (cellH + ROW_GAP_MM)),
  );
  return { cols: COLS, rowsPerPage, cardsPerPage: COLS * rowsPerPage };
}

const PAGE_W = GRUPOS_PDF_PAGE_MM[0];
const PAGE_H = GRUPOS_PDF_PAGE_MM[1];
const MARGIN_MM = 10;
const LOGO_BAND_MM = 22;
const FOOTER_BAND_MM = 18;
/** Tres cartas por fila, tamaño compacto para más filas por hoja. */
const COLS = 3;
const COL_GAP_MM = 5;
const ROW_GAP_MM = 5;
const IMG_W_MM = 32;
const IMG_H_MM = IMG_W_MM / CARD_ASPECT_RATIO;
const TEXT_BLOCK_MM = 12;

let logoDataUrlPromise: Promise<string> | null = null;

async function loadLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = (async () => {
      const res = await fetch(lockupUrl);
      if (!res.ok) throw new Error("No se pudo cargar el logo.");
      return readBlobAsDataUrl(await res.blob());
    })().catch((err: unknown) => {
      logoDataUrlPromise = null;
      throw err;
    });
  }
  return logoDataUrlPromise;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function pdfImageFormat(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function containBox(
  imgW: number,
  imgH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): { x: number; y: number; w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) {
    return { x: boxX, y: boxY, w: boxW, h: boxH };
  }
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: boxX + (boxW - w) / 2,
    y: boxY + (boxH - h) / 2,
    w,
    h,
  };
}

/** Encaja un rectángulo en un hueco sin deformar (como object-fit: contain). */
export function fitAspectRect(
  boxW: number,
  boxH: number,
  aspectRatio: number,
): { x: number; y: number; w: number; h: number } {
  let w = boxW;
  let h = w / aspectRatio;
  if (h > boxH) {
    h = boxH;
    w = h * aspectRatio;
  }
  return {
    x: (boxW - w) / 2,
    y: (boxH - h) / 2,
    w,
    h,
  };
}

export function filterAvailableStockForPdf(
  items: StockListItem[],
): StockInventoryPdfRow[] {
  return items
    .filter((item) => SELLABLE.has(String(item.card_state ?? "").trim()))
    .map((item) => ({
      _id: item._id,
      card_id: item.card_id,
      card_name: item.card_name,
      image_url: item.image_url,
      language: item.language,
      rareza: item.rareza,
      pvp: item.pvp,
      pvp_currency: item.pvp_currency,
      card_state: item.card_state,
    }))
    .sort((a, b) =>
      a.card_name.localeCompare(b.card_name, "es", { sensitivity: "base" }),
    );
}

/** Solo cartas disponibles que ya tienen foto de inventario tomada. */
export function filterStockWithInventoryPhotosForPdf(
  items: StockListItem[],
  photoIndex: Record<string, string>,
): StockInventoryPdfRow[] {
  return filterAvailableStockForPdf(items).filter((row) =>
    Boolean(photoIndex[row._id]?.trim()),
  );
}

export function resolveInventoryPhotoUrlForPdf(
  row: StockInventoryPdfRow,
  photoIndex: Record<string, string>,
): string {
  const fromIndex = photoIndex[row._id]?.trim();
  if (fromIndex) return rewriteStockPhotoUrl(fromIndex);
  return "";
}

export async function fetchStockImageDataUrl(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  return fetchInventoryPhotoDataUrl(imageUrl);
}

function formatPvpLine(
  row: StockInventoryPdfRow,
  toCopFromEur: (eur: number) => number | null,
): string {
  const pvp = row.pvp;
  if (pvp == null || pvp <= 0) return "Sin PVP";
  const cur = String(row.pvp_currency ?? "COP").toUpperCase();
  if (cur === "COP") return `COP ${formatCOP(String(Math.round(pvp)))}`;
  if (cur === "EUR") {
    const cop = toCopFromEur(pvp);
    return cop != null
      ? `EUR ${pvp.toFixed(2)} · COP ${formatCOP(String(Math.round(cop)))}`
      : `EUR ${pvp.toFixed(2)}`;
  }
  return `${cur} ${pvp}`;
}

function metaLine(row: StockInventoryPdfRow): string {
  const parts: string[] = [];
  const lang = String(row.language ?? "").trim();
  if (lang) parts.push(lang.toUpperCase());
  const rz = String(row.rareza ?? "").trim();
  if (rz) parts.push(operationalRarezaLabel(rz.toLowerCase()));
  parts.push(row.card_state.replace(/_/g, " "));
  parts.push(row.card_id);
  return parts.join(" · ");
}

export function buildInventoryPdfFilename(
  owner: OwnerKey,
  now = new Date(),
): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `inventario-fotos-${owner}-${y}${m}${d}.pdf`;
}

/** @deprecated Usar buildInventoryPdfFilename */
export function buildEstebanInventoryPdfFilename(now = new Date()): string {
  return buildInventoryPdfFilename("esteban", now);
}

type PreparedRow = {
  row: StockInventoryPdfRow;
  dataUrl: string;
};

function drawPageBackground(doc: jsPDF) {
  const [r, g, b] = hexToRgb(GRUPOS_PDF_BG);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function drawLogo(doc: jsPDF, logoDataUrl: string, logoW: number, logoH: number) {
  const boxX = MARGIN_MM;
  const boxW = PAGE_W - MARGIN_MM * 2;
  const boxY = 3;
  const box = containBox(logoW, logoH, boxX, boxY, boxW, LOGO_BAND_MM - 4);
  doc.addImage(
    logoDataUrl,
    pdfImageFormat(logoDataUrl),
    box.x,
    box.y,
    box.w,
    box.h,
    undefined,
    "NONE",
  );
  doc.link(box.x, box.y, box.w, box.h, { url: GRUPOS_PDF_WEB_URL });
}

function drawPageHeader(doc: jsPDF, logoDataUrl: string, logoW: number, logoH: number) {
  drawPageBackground(doc);
  drawLogo(doc, logoDataUrl, logoW, logoH);

  const [tr, tg, tb] = hexToRgb(GRUPOS_PDF_TEXT);
  doc.setTextColor(tr, tg, tb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Inventario fotográfico", MARGIN_MM, LOGO_BAND_MM + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(formatGruposPdfDate(new Date()), PAGE_W - MARGIN_MM, LOGO_BAND_MM + 1, {
    align: "right",
  });
}

function drawFooter(doc: jsPDF) {
  const footerTop = PAGE_H - FOOTER_BAND_MM;
  const [goldR, goldG, goldB] = hexToRgb(GRUPOS_PDF_GOLD);
  const [tr, tg, tb] = hexToRgb(GRUPOS_PDF_TEXT);

  doc.setDrawColor(goldR, goldG, goldB);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_MM, footerTop, PAGE_W - MARGIN_MM, footerTop);

  doc.setTextColor(tr, tg, tb);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const contacts = buildGruposPdfFooterContacts();
  doc.text(
    `${contacts[0].label}  ·  ${contacts[1].label}`,
    PAGE_W / 2,
    footerTop + 6,
    { align: "center" },
  );
  doc.setTextColor(11, 87, 208);
  doc.textWithLink(GRUPOS_PDF_WEB_URL, PAGE_W / 2, footerTop + 11, {
    align: "center",
    url: GRUPOS_PDF_WEB_URL,
  });
}

function drawCardCell(
  doc: jsPDF,
  item: PreparedRow,
  x: number,
  y: number,
  cellW: number,
  imgW: number,
  imgH: number,
  toCopFromEur: (eur: number) => number | null,
) {
  const [goldR, goldG, goldB] = hexToRgb(GRUPOS_PDF_GOLD);
  const [tr, tg, tb] = hexToRgb(GRUPOS_PDF_TEXT);
  const [chipR, chipG, chipB] = hexToRgb(GRUPOS_PDF_CHIP_BG);

  const imgX = x + (cellW - imgW) / 2;
  const imgY = y;

  doc.addImage(
    item.dataUrl,
    pdfImageFormat(item.dataUrl),
    imgX,
    imgY,
    imgW,
    imgH,
    undefined,
    "FAST",
  );

  doc.setDrawColor(goldR, goldG, goldB);
  doc.setLineWidth(0.25);
  doc.rect(imgX, imgY, imgW, imgH, "S");

  let textY = imgY + imgH + 3;
  doc.setTextColor(tr, tg, tb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  const nameLines = doc.splitTextToSize(item.row.card_name, cellW - 1);
  doc.text(nameLines.slice(0, 2), x + cellW / 2, textY, { align: "center" });
  textY += Math.min(nameLines.length, 2) * 3.2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(formatPvpLine(item.row, toCopFromEur), x + cellW / 2, textY + 1.5, {
    align: "center",
  });
  textY += 4.5;

  doc.setFillColor(chipR, chipG, chipB);
  doc.setDrawColor(goldR, goldG, goldB);
  doc.setLineWidth(0.15);
  const meta = metaLine(item.row);
  const metaLines = doc.splitTextToSize(meta, cellW - 4);
  const chipH = Math.min(metaLines.length, 2) * 2.8 + 2.5;
  const chipY = textY;
  doc.roundedRect(x + 0.5, chipY, cellW - 1, chipH, 1, 1, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(metaLines.slice(0, 2), x + cellW / 2, chipY + 3.5, { align: "center" });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagen ilegible"));
    img.src = src;
  });
}

/**
 * PDF catálogo visual: solo cartas con foto de inventario, recorte tal cual, marca El Nido.
 */
export async function exportStockInventoryPdf(
  rows: StockInventoryPdfRow[],
  opts: {
    toCopFromEur: (eur: number) => number | null;
    photoIndex: Record<string, string>;
    owner?: OwnerKey;
    title?: string;
    filename?: string;
  },
): Promise<{ rows: number; imageFailures: number }> {
  const eligible = rows.filter((row) =>
    Boolean(opts.photoIndex[row._id]?.trim()),
  );

  if (eligible.length === 0) {
    throw new Error(
      "No hay cartas con foto de inventario para exportar. Toma fotos primero.",
    );
  }

  const prepared: PreparedRow[] = [];
  let imageFailures = 0;

  const dataUrls = await mapWithConcurrency(eligible, (row) =>
    fetchStockImageDataUrl(resolveInventoryPhotoUrlForPdf(row, opts.photoIndex)),
  );
  eligible.forEach((row, i) => {
    const dataUrl = dataUrls[i];
    if (!dataUrl) {
      imageFailures += 1;
      return;
    }
    prepared.push({ row, dataUrl });
  });

  if (prepared.length === 0) {
    throw new Error("No se pudieron cargar las fotos de inventario para el PDF.");
  }

  const logoDataUrl = await loadLogoDataUrl();
  const logoImg = await loadHtmlImage(logoDataUrl);
  const logoW = logoImg.naturalWidth || logoImg.width;
  const logoH = logoImg.naturalHeight || logoImg.height;

  const JsPdf = await loadJsPdf();
  const doc = new JsPdf({
    orientation: "portrait",
    unit: "mm",
    format: GRUPOS_PDF_FORMAT,
  });

  const contentTop = LOGO_BAND_MM + 5;
  const contentBottom = PAGE_H - FOOTER_BAND_MM - 2;
  const cellW = (PAGE_W - MARGIN_MM * 2 - COL_GAP_MM * (COLS - 1)) / COLS;
  const imgW = Math.min(IMG_W_MM, cellW - 2);
  const imgH = imgW / CARD_ASPECT_RATIO;
  const cellH = imgH + TEXT_BLOCK_MM;
  const rowsPerPage = Math.max(
    1,
    Math.floor((contentBottom - contentTop + ROW_GAP_MM) / (cellH + ROW_GAP_MM)),
  );

  prepared.forEach((item, index) => {
    const indexInPage = index % (COLS * rowsPerPage);
    if (indexInPage === 0) {
      if (index > 0) doc.addPage();
      drawPageHeader(doc, logoDataUrl, logoW, logoH);
      drawFooter(doc);
    }

    const col = indexInPage % COLS;
    const rowIdx = Math.floor(indexInPage / COLS);
    const x = MARGIN_MM + col * (cellW + COL_GAP_MM);
    const y = contentTop + rowIdx * (cellH + ROW_GAP_MM);

    drawCardCell(doc, item, x, y, cellW, imgW, imgH, opts.toCopFromEur);
  });

  doc.save(
    opts.filename ??
      buildInventoryPdfFilename(opts.owner ?? "pablo"),
  );
  return { rows: prepared.length, imageFailures };
}
