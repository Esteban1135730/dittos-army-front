import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatCOP } from "../../utils/convert";

export type VentaPdfStockMeta = {
  card_id: string;
  card_name: string;
  image_url?: string;
  rareza?: string | null;
};

export type VentaPdfReservaLine = {
  stock_id: string;
  precio: number;
  currency: string;
};

export type VentaPdfCurrencyConverter = {
  toCopFromEur?: (value: number) => number | null;
  toCopFromUsd?: (value: number) => number | null;
};

export type VentaPdfGroupRow = {
  card_id: string;
  card_name: string;
  rareza: string;
  image_url?: string;
  quantity: number;
  unitPriceCop: number;
  lineTotalCop: number;
};

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const LOCALE_ES = "es";

export function normalizeRareza(rareza?: string | null): string {
  return rareza?.trim() ?? "";
}

export function reservaPrecioToCop(
  precio: number,
  currency: string,
  convert?: VentaPdfCurrencyConverter,
): number {
  const normalized = currency.trim().toUpperCase();
  if (normalized === "COP") {
    return Math.round(precio);
  }
  if (normalized === "EUR" && convert?.toCopFromEur) {
    const value = convert.toCopFromEur(precio);
    return value != null ? Math.round(value) : Math.round(precio);
  }
  if (normalized === "USD" && convert?.toCopFromUsd) {
    const value = convert.toCopFromUsd(precio);
    return value != null ? Math.round(value) : Math.round(precio);
  }
  return Math.round(precio);
}

export function buildReservaGroupKey(
  cardId: string,
  rareza: string | null | undefined,
  precio: number,
  currency: string,
  convert?: VentaPdfCurrencyConverter,
): string {
  const unitCop = reservaPrecioToCop(precio, currency, convert);
  return `${cardId}|${normalizeRareza(rareza)}|${unitCop}`;
}

export function compareVentaPdfGroups(a: VentaPdfGroupRow, b: VentaPdfGroupRow): number {
  const byName = a.card_name.localeCompare(b.card_name, LOCALE_ES, { sensitivity: "base" });
  if (byName !== 0) return byName;
  const byRareza = a.rareza.localeCompare(b.rareza, LOCALE_ES, { sensitivity: "base" });
  if (byRareza !== 0) return byRareza;
  return a.unitPriceCop - b.unitPriceCop;
}

export function groupReservasForVentaPdf(
  reservas: VentaPdfReservaLine[],
  stockById: Record<string, VentaPdfStockMeta | undefined>,
  convert?: VentaPdfCurrencyConverter,
): VentaPdfGroupRow[] {
  const grouped = new Map<string, VentaPdfGroupRow>();

  for (const reserva of reservas) {
    const stock = stockById[reserva.stock_id];
    const cardId = stock?.card_id ?? reserva.stock_id;
    const cardName = stock?.card_name ?? "Carta";
    const rareza = normalizeRareza(stock?.rareza);
    const unitPriceCop = reservaPrecioToCop(reserva.precio, reserva.currency, convert);
    const key = buildReservaGroupKey(cardId, rareza, reserva.precio, reserva.currency, convert);
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += 1;
      existing.lineTotalCop = existing.quantity * existing.unitPriceCop;
      continue;
    }

    grouped.set(key, {
      card_id: cardId,
      card_name: cardName,
      rareza,
      image_url: stock?.image_url,
      quantity: 1,
      unitPriceCop,
      lineTotalCop: unitPriceCop,
    });
  }

  return [...grouped.values()].sort(compareVentaPdfGroups);
}

export function totalCopFromGroups(groups: VentaPdfGroupRow[]): number {
  return groups.reduce((sum, row) => sum + row.lineTotalCop, 0);
}

export function slugClienteForFilename(nombre: string): string {
  const slug = nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "cliente";
}

export function buildVentaPdfFilename(nombre: string, now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `venta-${slugClienteForFilename(nombre)}-${year}${month}${day}.pdf`;
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 120;
      canvas.height = img.naturalHeight || 168;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawPlaceholder(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setFillColor(220, 220, 220);
  doc.rect(x, y, width, height, "F");
}

export async function downloadVentaClientePdf(opts: {
  clientName: string;
  descripcionEntrega?: string;
  fechaTentativa?: string;
  reservas: VentaPdfReservaLine[];
  stockById: Record<string, VentaPdfStockMeta | undefined>;
  convert?: VentaPdfCurrencyConverter;
}): Promise<{ imageFailures: number }> {
  const groups = groupReservasForVentaPdf(opts.reservas, opts.stockById, opts.convert);
  if (groups.length === 0) {
    throw new Error("Sin líneas para el PDF de venta.");
  }

  const imageDataUrls: Array<string | null> = [];
  let imageFailures = 0;

  for (const group of groups) {
    if (!group.image_url?.trim()) {
      imageDataUrls.push(null);
      imageFailures += 1;
      continue;
    }
    const dataUrl = await loadImageDataUrl(group.image_url);
    imageDataUrls.push(dataUrl);
    if (!dataUrl) {
      imageFailures += 1;
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }) as JsPdfWithAutoTable;
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Resumen de venta", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Cliente: ${opts.clientName}`, margin, y);
  y += 5;
  if (opts.descripcionEntrega?.trim()) {
    doc.text(`Entrega: ${opts.descripcionEntrega.trim()}`, margin, y);
    y += 5;
  }
  if (opts.fechaTentativa?.trim()) {
    doc.text(`Fecha tentativa: ${opts.fechaTentativa.trim()}`, margin, y);
    y += 5;
  }
  y += 3;

  const body = groups.map((group) => [
    "",
    group.card_name,
    group.card_id,
    group.rareza || "—",
    String(group.quantity),
    formatCOP(group.unitPriceCop),
    formatCOP(group.lineTotalCop),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["", "Carta", "ID carta", "Rareza", "Cant.", "Valor unit.", "Valor lote"]],
    body,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 20,
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18, halign: "center" },
      1: { cellWidth: 42 },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { halign: "center", cellWidth: 14 },
      5: { halign: "right", cellWidth: 24 },
      6: { halign: "right", cellWidth: 26 },
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
        doc.addImage(imageDataUrl, "JPEG", x, cellY, width, height);
        return;
      }
      drawPlaceholder(doc, x, cellY, width, height);
    },
  });

  const total = totalCopFromGroups(groups);
  const totalY = (doc.lastAutoTable?.finalY ?? y) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total: ${formatCOP(total)}`, margin, totalY, { maxWidth });

  doc.save(buildVentaPdfFilename(opts.clientName));
  return { imageFailures };
}
