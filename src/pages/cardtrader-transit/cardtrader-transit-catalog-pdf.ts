import type { jsPDF } from "jspdf";
import { fetchCartImageDataUrl } from "../../utils/cardtrader-cart-image";
import { mapWithConcurrency } from "../../utils/concurrency";
import { loadJsPdfWithAutoTable } from "../../utils/pdf-libs";
import { formatCOP } from "../../utils/convert";
import {
  buildGruposPdfFooterContacts,
  GRUPOS_PDF_CHIP_BG,
  GRUPOS_PDF_GOLD,
  GRUPOS_PDF_WEB_URL,
  prepareNidoTcgPdfAssets,
  readBlobAsDataUrl,
  type NidoTcgPdfAssets,
} from "../pdf-grupos/pdf-grupos";
import type { TransitCatalogCardGroup } from "./cardtrader-transit-catalog-group";
import { totalCostCop } from "./cardtrader-transit-catalog-group";

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const LOCALE_ES = "es";
const NO_EXPANSION = "Sin expansión";

export type TransitCatalogPdfLine = {
  name: string;
  imageUrl?: string;
  qty: number;
  unitCostCop: number;
  lineCostCop: number;
  meta?: {
    expansion?: string;
    collectorNumber?: string;
    language?: string;
    rarity?: string;
  };
};

export function transitGroupToPdfLine(group: TransitCatalogCardGroup): TransitCatalogPdfLine {
  return {
    name: group.card_name,
    imageUrl: group.image_url || undefined,
    qty: group.remaining_quantity,
    unitCostCop: group.unit_cost_cop,
    lineCostCop: group.total_cost_cop,
    meta: {
      expansion: group.expansion ?? undefined,
      collectorNumber: group.collector_number ?? undefined,
      language: group.language,
      rarity: group.rareza ?? undefined,
    },
  };
}

export function buildTransitCatalogDetailText(line: TransitCatalogPdfLine): string {
  const parts: string[] = [];
  const meta = line.meta;
  if (meta?.expansion?.trim()) parts.push(meta.expansion.trim());
  if (meta?.collectorNumber?.trim()) parts.push(`#${meta.collectorNumber.trim()}`);
  if (meta?.rarity?.trim()) parts.push(meta.rarity.trim());
  if (meta?.language?.trim()) parts.push(meta.language.trim().toUpperCase());
  const detail = parts.length ? parts.join(" · ") : "";
  return detail ? `${line.name}\n${detail}` : line.name;
}

function expansionKey(line: TransitCatalogPdfLine): string {
  return line.meta?.expansion?.trim() ?? "";
}

export function compareTransitCatalogPdfLines(
  a: TransitCatalogPdfLine,
  b: TransitCatalogPdfLine,
): number {
  const expA = expansionKey(a);
  const expB = expansionKey(b);
  if (!expA && expB) return 1;
  if (expA && !expB) return -1;
  if (expA && expB) {
    const byExpansion = expA.localeCompare(expB, LOCALE_ES, { sensitivity: "base" });
    if (byExpansion !== 0) return byExpansion;
  }
  const byName = a.name.localeCompare(b.name, LOCALE_ES, { sensitivity: "base" });
  if (byName !== 0) return byName;
  const numA = a.meta?.collectorNumber?.trim() ?? "";
  const numB = b.meta?.collectorNumber?.trim() ?? "";
  return numA.localeCompare(numB, LOCALE_ES, { numeric: true, sensitivity: "base" });
}

export type TransitCatalogPdfTableRow =
  | { kind: "group"; label: string }
  | { kind: "line"; line: TransitCatalogPdfLine; detail: string };

export function buildTransitCatalogPdfTableRows(
  lines: TransitCatalogPdfLine[],
): TransitCatalogPdfTableRow[] {
  const sorted = [...lines].sort(compareTransitCatalogPdfLines);
  const rows: TransitCatalogPdfTableRow[] = [];
  let currentExpansion = "";
  let buffer: TransitCatalogPdfLine[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const expansion = expansionKey(buffer[0]) || NO_EXPANSION;
    const noun = buffer.length === 1 ? "carta" : "cartas";
    rows.push({ kind: "group", label: `${expansion} · ${buffer.length} ${noun}` });
    for (const line of buffer) {
      const meta = line.meta?.expansion?.trim()
        ? { ...line.meta, expansion: undefined }
        : line.meta;
      rows.push({
        kind: "line",
        line,
        detail: buildTransitCatalogDetailText({ ...line, meta }),
      });
    }
    buffer = [];
  };

  for (const line of sorted) {
    const exp = expansionKey(line) || NO_EXPANSION;
    if (buffer.length && currentExpansion !== exp) {
      flush();
    }
    currentExpansion = exp;
    buffer.push(line);
  }
  flush();
  return rows;
}

export function buildTransitCatalogPdfFilename(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `transito-cartas-${year}${month}${day}.pdf`;
}

function pdfImageFormat(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function drawPlaceholder(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setFillColor(220, 220, 220);
  doc.rect(x, y, width, height, "F");
}

const NIDO_LOGO_TOP_MM = 6;
const NIDO_LOGO_MAX_H_MM = 22;
const NIDO_LOGO_MAX_W_MM = 36;

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

async function loadElNidoLockupDataUrl(): Promise<string> {
  const mod = (await import("../pdf-grupos/el-nido-tcg-lockup.png")) as { default: string };
  const res = await fetch(mod.default);
  if (!res.ok) {
    throw new Error("No se pudo cargar el logo.");
  }
  return readBlobAsDataUrl(await res.blob());
}

function nidoLogoBox(
  logoWidth: number,
  logoHeight: number,
  pageW: number,
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(
    NIDO_LOGO_MAX_W_MM / Math.max(logoWidth, 1),
    NIDO_LOGO_MAX_H_MM / Math.max(logoHeight, 1),
  );
  const w = logoWidth * scale;
  const h = logoHeight * scale;
  return {
    x: (pageW - w) / 2,
    y: NIDO_LOGO_TOP_MM,
    w,
    h,
  };
}

function drawNidoLockup(doc: jsPDF, brand: NidoTcgPdfAssets, pageW: number): number {
  const box = nidoLogoBox(brand.logoWidth, brand.logoHeight, pageW);
  doc.addImage(
    brand.logoDataUrl,
    pdfImageFormat(brand.logoDataUrl),
    box.x,
    box.y,
    box.w,
    box.h,
  );
  doc.link(box.x, box.y, box.w, box.h, { url: GRUPOS_PDF_WEB_URL });
  return box.y + box.h;
}

function drawNidoContacts(
  doc: jsPDF,
  y: number,
  margin: number,
  pageW: number,
  brand: NidoTcgPdfAssets,
): void {
  const contacts = buildGruposPdfFooterContacts();
  const gap = 4;
  const chipH = 10;
  const iconMm = 5.5;
  const innerW = pageW - margin * 2;
  const chipW = (innerW - gap) / contacts.length;
  const [goldR, goldG, goldB] = hexToRgb(GRUPOS_PDF_GOLD);
  const [chipR, chipG, chipB] = hexToRgb(GRUPOS_PDF_CHIP_BG);
  const linkRgb: [number, number, number] = [11, 87, 208];

  contacts.forEach((contact, index) => {
    const x = margin + index * (chipW + gap);
    doc.setFillColor(chipR, chipG, chipB);
    doc.setDrawColor(goldR, goldG, goldB);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, chipW, chipH, 1.6, 1.6, "FD");

    const iconData = contact.kind === "instagram" ? brand.instagramIcon : brand.whatsappIcon;
    const iconX = x + 2.4;
    const iconY = y + (chipH - iconMm) / 2;
    doc.addImage(iconData, "PNG", iconX, iconY, iconMm, iconMm);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...linkRgb);
    const textX = iconX + iconMm + 1.8;
    const textY = y + chipH / 2 + 1.1;
    doc.textWithLink(contact.label, textX, textY, { url: contact.url });
    doc.link(x, y, chipW, chipH, { url: contact.url });
  });
}

export async function downloadTransitCatalogPdf(opts: {
  groups: TransitCatalogCardGroup[];
  apiBase: string;
  title?: string;
}): Promise<{ imageFailures: number }> {
  const lines = opts.groups.map(transitGroupToPdfLine).filter((l) => l.qty > 0);
  if (lines.length === 0) {
    throw new Error("Sin cartas en tránsito para exportar.");
  }

  const tableRows = buildTransitCatalogPdfTableRows(lines);
  const pdfLines = tableRows.flatMap((row) => (row.kind === "line" ? [row.line] : []));

  const imageByLine = new Map<TransitCatalogPdfLine, string | null>();
  let imageFailures = 0;

  const dataUrls = await mapWithConcurrency(pdfLines, (line) =>
    line.imageUrl?.trim()
      ? fetchCartImageDataUrl(line.imageUrl, opts.apiBase)
      : Promise.resolve(null),
  );
  pdfLines.forEach((line, i) => {
    const dataUrl = dataUrls[i];
    imageByLine.set(line, dataUrl);
    if (!dataUrl) imageFailures += 1;
  });

  const imageAtRow: Array<string | null | "skip"> = tableRows.map((row) =>
    row.kind === "group" ? "skip" : (imageByLine.get(row.line) ?? null),
  );

  let brand: NidoTcgPdfAssets;
  try {
    brand = await prepareNidoTcgPdfAssets(await loadElNidoLockupDataUrl());
  } catch (err) {
    throw err instanceof Error ? err : new Error("No se pudo cargar el logo de El Nido TCG.");
  }

  const { jsPDF: JsPdf, autoTable } = await loadJsPdfWithAutoTable();
  const doc = new JsPdf({ unit: "mm", format: "a4", orientation: "portrait" }) as JsPdfWithAutoTable;
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logoBox = nidoLogoBox(brand.logoWidth, brand.logoHeight, pageW);
  const contentTop = logoBox.y + logoBox.h + 6;
  let y = contentTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(opts.title?.trim() || "Cartas en tránsito", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateLabel = new Date().toLocaleDateString(LOCALE_ES, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(dateLabel, margin, y);
  y += 8;

  const body = tableRows.map((row) => {
    if (row.kind === "group") {
      return [
        {
          content: row.label,
          colSpan: 4,
          styles: {
            fontStyle: "bold" as const,
            fillColor: [226, 232, 240] as [number, number, number],
            textColor: [15, 23, 42] as [number, number, number],
            minCellHeight: 8,
            valign: "middle" as const,
            halign: "left" as const,
            fontSize: 9,
          },
        },
      ];
    }
    return ["", row.detail, String(row.line.qty), formatCOP(row.line.unitCostCop)];
  });

  autoTable(doc, {
    startY: y,
    head: [["", "Detalle", "Cant.", "Costo (COP)"]],
    body,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 24,
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 88 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 34 },
    },
    margin: { top: contentTop, left: margin, right: margin, bottom: 12 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: () => {
      drawNidoLockup(doc, brand, pageW);
    },
    didParseCell: (data) => {
      if (data.section !== "body" || imageAtRow[data.row.index] !== "skip") return;
      data.cell.styles.minCellHeight = 8;
      data.cell.styles.fontStyle = "bold";
      data.cell.styles.fillColor = [226, 232, 240];
      data.cell.styles.textColor = [15, 23, 42];
    },
    didDrawCell: (data) => {
      if (data.column.index !== 0 || data.section !== "body") {
        return;
      }
      const imageDataUrl = imageAtRow[data.row.index];
      if (imageDataUrl === "skip" || imageDataUrl === undefined) {
        return;
      }
      const pad = 1;
      const x = data.cell.x + pad;
      const cellY = data.cell.y + pad;
      const width = data.cell.width - pad * 2;
      const height = data.cell.height - pad * 2;
      if (imageDataUrl) {
        doc.addImage(imageDataUrl, pdfImageFormat(imageDataUrl), x, cellY, width, height);
        return;
      }
      drawPlaceholder(doc, x, cellY, width, height);
    },
  });

  const total = totalCostCop(opts.groups);
  const contactH = 10;
  const contactGap = 5;
  let totalY = (doc.lastAutoTable?.finalY ?? y) + 8;
  if (totalY + contactGap + contactH > pageH - 10) {
    doc.addPage();
    drawNidoLockup(doc, brand, pageW);
    totalY = contentTop;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Costo total (restante): ${formatCOP(total)}`, margin, totalY);
  drawNidoContacts(doc, totalY + contactGap, margin, pageW, brand);

  doc.save(buildTransitCatalogPdfFilename(new Date()));
  return { imageFailures };
}
