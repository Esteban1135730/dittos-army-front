import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { resolveCartImageDataUrlForPdf } from "../../utils/cardtrader-cart-image";
import { formatCOP } from "../../utils/convert";

export type CotizarCartPdfMeta = {
  expansion?: string;
  condition?: string;
  language?: string;
  collectorNumber?: string;
  rarity?: string;
};

export type CotizarCartPdfLine = {
  productId: number;
  name: string;
  imageUrl?: string;
  imageDataUrl?: string;
  qty: number;
  pvpUnitCop: number;
  pvpLineCop: number;
  meta?: CotizarCartPdfMeta;
};

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const LOCALE_ES = "es";

export function buildCardtraderCartDetailText(name: string, meta?: CotizarCartPdfMeta): string {
  const parts: string[] = [];
  if (meta?.expansion?.trim()) parts.push(meta.expansion.trim());
  if (meta?.collectorNumber?.trim()) parts.push(`#${meta.collectorNumber.trim()}`);
  if (meta?.rarity?.trim()) parts.push(meta.rarity.trim());
  if (meta?.condition?.trim()) parts.push(meta.condition.trim());
  if (meta?.language?.trim()) parts.push(meta.language.trim().toUpperCase());
  const detail = parts.length ? parts.join(" · ") : "";
  return detail ? `${name}\n${detail}` : name;
}

export function compareCotizarCartPdfLines(a: CotizarCartPdfLine, b: CotizarCartPdfLine): number {
  const byName = a.name.localeCompare(b.name, LOCALE_ES, { sensitivity: "base" });
  if (byName !== 0) return byName;
  return a.pvpUnitCop - b.pvpUnitCop;
}

export function totalPvpCopFromLines(lines: CotizarCartPdfLine[]): number {
  return lines.reduce((sum, row) => sum + row.pvpLineCop, 0);
}

export function buildCardtraderCartPdfFilename(now = new Date(), suffix?: string): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;
  return suffix?.trim()
    ? `cotizacion-${suffix.trim()}-${datePart}.pdf`
    : `cotizacion-${datePart}.pdf`;
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

export async function downloadCardtraderCartClientePdf(opts: {
  lines: CotizarCartPdfLine[];
  apiBase: string;
  title?: string;
  totalLabel?: string;
  filenameSuffix?: string;
}): Promise<{ imageFailures: number }> {
  const lines = [...opts.lines].sort(compareCotizarCartPdfLines);
  if (lines.length === 0) {
    throw new Error("Sin líneas para exportar el carrito.");
  }

  const imageDataUrls: Array<string | null> = [];
  let imageFailures = 0;

  for (const line of lines) {
    const dataUrl = await resolveCartImageDataUrlForPdf({
      productId: line.productId,
      imageDataUrl: line.imageDataUrl,
      imageUrl: line.imageUrl,
      apiBase: opts.apiBase,
    });
    imageDataUrls.push(dataUrl);
    if (!dataUrl) {
      imageFailures += 1;
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }) as JsPdfWithAutoTable;
  const margin = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(opts.title?.trim() || "Cotización", margin, y);
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

  const body = lines.map((line) => [
    "",
    buildCardtraderCartDetailText(line.name, line.meta),
    String(line.qty),
    formatCOP(line.pvpUnitCop),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["", "Detalle", "Cant.", "PVP (COP)"]],
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
    margin: { left: margin, right: margin },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawCell: (data) => {
      if (data.column.index !== 0 || data.section !== "body") {
        return;
      }
      const pad = 1;
      const x = data.cell.x + pad;
      const cellY = data.cell.y + pad;
      const width = data.cell.width - pad * 2;
      const height = data.cell.height - pad * 2;
      const imageDataUrl = imageDataUrls[data.row.index];
      if (imageDataUrl) {
        doc.addImage(imageDataUrl, pdfImageFormat(imageDataUrl), x, cellY, width, height);
        return;
      }
      drawPlaceholder(doc, x, cellY, width, height);
    },
  });

  const total = totalPvpCopFromLines(lines);
  const totalY = (doc.lastAutoTable?.finalY ?? y) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const totalLabel = opts.totalLabel?.trim() || "PVP total (aprox.):";
  doc.text(`${totalLabel} ${formatCOP(total)}`, margin, totalY);

  doc.save(buildCardtraderCartPdfFilename(new Date(), opts.filenameSuffix));
  return { imageFailures };
}
