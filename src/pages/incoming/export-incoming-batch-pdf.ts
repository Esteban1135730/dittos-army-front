import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

function fmtCOP(n: number) {
  return Math.round(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export type BatchMetaPdf = {
  batch_id: string;
  status: string;
  purchase_date: string;
  total_eur_cards_cost: number;
  total_cop_cards_cost: number;
  real_euro_rate_cop_per_eur: number;
};

export type BatchItemPdf = {
  card_name: string;
  card_id: string;
  language: string;
  rareza?: string | null;
  quantity_ordered: number;
  remaining_quantity: number;
  eur_total_lot: number;
  eur_unit_price: number;
  unit_cost_cop: number;
};

/** jsPDF tras autoTable (finalY del último dibujado). */
type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function addWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: number,
): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxW);
  const pageH = doc.internal.pageSize.getHeight();
  const marginB = 14;
  const lineH = fontSize * 0.55;
  let cy = y;
  for (const ln of lines) {
    if (cy + lineH > pageH - marginB) {
      doc.addPage();
      cy = 14;
    }
    doc.text(ln, x, cy);
    cy += lineH + 0.4;
  }
  return cy + 1;
}

function drawItemsTable(doc: JsPdfWithAutoTable, items: BatchItemPdf[], startY: number, margin: number): number {
  const head = [
    [
      "#",
      "Carta",
      "ID carta",
      "Idioma",
      "Rareza",
      "Cant.",
      "Pend.",
      "EUR lote",
      "EUR u.",
      "COP u.",
      "COP línea",
    ],
  ];

  const body =
    items.length === 0
      ? [["—", "(Sin líneas en este pedido)", "", "", "", "", "", "", "", "", ""]]
      : items.map((it, i) => {
          const copLinea = Number(it.unit_cost_cop) * Number(it.quantity_ordered);
          return [
            String(i + 1),
            it.card_name,
            it.card_id,
            it.language,
            it.rareza?.trim() ? String(it.rareza) : "—",
            String(it.quantity_ordered),
            String(it.remaining_quantity),
            Number(it.eur_total_lot).toFixed(2),
            Number(it.eur_unit_price).toFixed(4),
            fmtCOP(it.unit_cost_cop),
            fmtCOP(copLinea),
          ];
        });

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      valign: "middle",
      overflow: "linebreak",
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 52 },
      2: { cellWidth: 24 },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "center", cellWidth: 12 },
      5: { halign: "right", cellWidth: 11 },
      6: { halign: "right", cellWidth: 11 },
      7: { halign: "right", cellWidth: 18 },
      8: { halign: "right", cellWidth: 18 },
      9: { halign: "right", cellWidth: 22 },
      10: { halign: "right", cellWidth: 26 },
    },
    margin: { left: margin, right: margin },
    showHead: "everyPage",
  });

  return doc.lastAutoTable?.finalY ?? startY;
}

/** Contenido de un lote (sin título global de página). */
function renderOneBatchBody(
  doc: JsPdfWithAutoTable,
  meta: BatchMetaPdf,
  items: BatchItemPdf[],
  margin: number,
  maxW: number,
  y: number,
): number {
  let cy = y;
  cy = addWrapped(doc, `Identificador del lote: ${meta.batch_id}`, margin, cy, maxW, 9);
  cy = addWrapped(
    doc,
    `Fecha de compra: ${new Date(meta.purchase_date).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })} · Estado: ${meta.status}`,
    margin,
    cy,
    maxW,
    9,
  );
  cy = addWrapped(
    doc,
    `Total cartas (EUR): ${meta.total_eur_cards_cost.toFixed(2)} · Total cartas (COP, sin envío): ${fmtCOP(meta.total_cop_cards_cost)} · Tasa real: ${meta.real_euro_rate_cop_per_eur.toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP por EUR`,
    margin,
    cy,
    maxW,
    9,
  );
  cy += 3;

  cy = drawItemsTable(doc, items, cy, margin);
  return cy;
}

function createLandscapeDoc(): JsPdfWithAutoTable {
  return new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" }) as JsPdfWithAutoTable;
}

export function exportIncomingBatchToPdf(meta: BatchMetaPdf, items: BatchItemPdf[]) {
  const doc = createLandscapeDoc();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxW = pageW - 2 * margin;

  let y = margin;
  y = addWrapped(doc, "Compra en camino — detalle de cartas y costos", margin, y, maxW, 14);
  y = renderOneBatchBody(doc, meta, items, margin, maxW, y);

  const safeName = meta.batch_id.replace(/[^\w.-]+/g, "_").slice(0, 40);
  doc.save(`compra-en-camino-${safeName}.pdf`);
}

export function exportAllOpenIncomingBatchesToPdf(
  sections: Array<{ meta: BatchMetaPdf; items: BatchItemPdf[] }>,
) {
  const doc = createLandscapeDoc();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxW = pageW - 2 * margin;

  let y = margin;
  y = addWrapped(doc, "Compras en camino — lotes abiertos", margin, y, maxW, 14);
  y = addWrapped(
    doc,
    `Documento con ${sections.length} lote(s). Cada sección incluye cartas y costos de compra (COP sin envío).`,
    margin,
    y,
    maxW,
    9,
  );
  y += 2;

  sections.forEach((sec, idx) => {
    if (idx > 0) {
      doc.addPage();
      y = margin;
    }
    y = addWrapped(doc, `— Lote ${idx + 1} de ${sections.length} —`, margin, y, maxW, 11);
    y = renderOneBatchBody(doc, sec.meta, sec.items, margin, maxW, y);
  });

  doc.save(`compras-en-camino-lotes-abiertos.pdf`);
}
