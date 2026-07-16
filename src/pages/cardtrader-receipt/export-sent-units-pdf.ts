import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { fetchCartImageDataUrl } from "../../utils/cardtrader-cart-image";

/** Campos mínimos de una unidad sent / tránsito para el PDF (sin datos sensibles). */
export type SentUnitsPdfSource = {
  name: string;
  language?: string | null;
  rareza?: string | null;
  blueprint_id?: number | null;
  /** Cantidad de unidades que representa esta fila (default 1). */
  qty?: number;
  /** URL de imagen (CDN, proxy Nest o data URL). No se imprime como texto. */
  imageUrl?: string | null;
};

export type BlueprintGroupedPdfRow = {
  name: string;
  language: string;
  rareza: string;
  units: number;
  /** Interno: para resolver imagen. No se muestra en columnas del PDF. */
  blueprintId?: number | null;
  /** Interno: primera URL de imagen del grupo. */
  imageUrl?: string | null;
};

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const LOCALE_ES = "es";

function normalizeLang(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  return s || "—";
}

function rarezaDisplay(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  return operationalRarezaLabel(s.toLowerCase());
}

function joinUnique(values: string[]): string {
  const uniq = [...new Set(values.filter((v) => v && v !== "—"))].sort((a, b) =>
    a.localeCompare(b, LOCALE_ES, { sensitivity: "base" }),
  );
  return uniq.length ? uniq.join(", ") : "—";
}

/**
 * Agrupa por blueprint_id (solo). Si no hay blueprint, cae a nombre+idioma+rareza.
 * No incluye precios, pedidos ni IDs en columnas visibles del PDF.
 */
export function groupSentUnitsByBlueprint(
  units: SentUnitsPdfSource[],
): BlueprintGroupedPdfRow[] {
  type Acc = {
    names: string[];
    languages: string[];
    rarezas: string[];
    units: number;
    blueprintId: number | null;
    imageUrl: string | null;
  };

  const map = new Map<string, Acc>();

  for (const u of units) {
    const qty = Math.max(1, Math.floor(u.qty ?? 1));
    const name = String(u.name ?? "").trim() || "(Sin nombre)";
    const language = normalizeLang(u.language);
    const rareza = rarezaDisplay(u.rareza);
    const bp =
      typeof u.blueprint_id === "number" && u.blueprint_id > 0
        ? u.blueprint_id
        : null;
    const imageUrl = u.imageUrl?.trim() || null;
    const key =
      bp != null
        ? `bp:${bp}`
        : `name:${name.toLowerCase()}|${language.toLowerCase()}|${rareza.toLowerCase()}`;

    const prev = map.get(key);
    if (prev) {
      prev.names.push(name);
      prev.languages.push(language);
      prev.rarezas.push(rareza);
      prev.units += qty;
      if (!prev.imageUrl && imageUrl) prev.imageUrl = imageUrl;
    } else {
      map.set(key, {
        names: [name],
        languages: [language],
        rarezas: [rareza],
        units: qty,
        blueprintId: bp,
        imageUrl,
      });
    }
  }

  const rows: BlueprintGroupedPdfRow[] = [];
  for (const acc of map.values()) {
    const nameCounts = new Map<string, number>();
    for (const n of acc.names) {
      nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    }
    let bestName = acc.names[0] ?? "(Sin nombre)";
    let bestCount = 0;
    for (const [n, c] of nameCounts) {
      if (c > bestCount) {
        bestName = n;
        bestCount = c;
      }
    }
    rows.push({
      name: bestName,
      language: joinUnique(acc.languages),
      rareza: joinUnique(acc.rarezas),
      units: acc.units,
      blueprintId: acc.blueprintId,
      imageUrl: acc.imageUrl,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, LOCALE_ES, { sensitivity: "base" }));
  return rows;
}

export function buildSentUnitsPdfFilename(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `cartas-en-envio-${y}${m}${d}.pdf`;
}

export function totalUnitsFromRows(rows: BlueprintGroupedPdfRow[]): number {
  return rows.reduce((sum, r) => sum + r.units, 0);
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

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/** Resuelve data URL: ya es data, proxy Nest directo, o CDN vía proxy. */
export async function resolveSentUnitImageDataUrl(
  imageUrl: string | null | undefined,
  apiBase: string,
): Promise<string | null> {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;

  if (trimmed.includes("/cardtrader/images/proxy")) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.size) return null;
      return blobToDataUrl(blob);
    } catch {
      return null;
    }
  }

  return fetchCartImageDataUrl(trimmed, apiBase);
}

/**
 * PDF de cartas en envío con imagen: nombre, idioma, rareza y unidades (agrupado por blueprint).
 */
export async function exportSentUnitsByBlueprintToPdf(
  units: SentUnitsPdfSource[],
  opts?: {
    title?: string;
    filename?: string;
    apiBase?: string;
    /** Mapa blueprint_id → URL (proxy / data). Se usa si la unidad no trae imageUrl. */
    imageUrlByBlueprint?: Record<number, string>;
  },
): Promise<{ rows: number; units: number; imageFailures: number }> {
  const enriched = units.map((u) => {
    const bp =
      typeof u.blueprint_id === "number" && u.blueprint_id > 0 ? u.blueprint_id : null;
    const fromMap =
      bp != null && opts?.imageUrlByBlueprint
        ? opts.imageUrlByBlueprint[bp]
        : undefined;
    return {
      ...u,
      imageUrl: u.imageUrl?.trim() || fromMap || null,
    };
  });

  const rows = groupSentUnitsByBlueprint(enriched);
  if (rows.length === 0) {
    throw new Error("No hay cartas para exportar.");
  }

  const apiBase = opts?.apiBase?.trim() || "";
  const imageDataUrls: Array<string | null> = [];
  let imageFailures = 0;

  for (const row of rows) {
    const dataUrl = apiBase
      ? await resolveSentUnitImageDataUrl(row.imageUrl, apiBase)
      : row.imageUrl?.startsWith("data:")
        ? row.imageUrl
        : null;
    imageDataUrls.push(dataUrl);
    if (!dataUrl) imageFailures += 1;
  }

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  }) as JsPdfWithAutoTable;
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - 2 * margin;
  let y = margin;

  const title = opts?.title?.trim() || "Cartas en envío";
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const totalU = totalUnitsFromRows(rows);
  const subtitle = `${rows.length} carta(s) distinta(s) · ${totalU} unidad(es) · agrupado por blueprint`;
  const lines = doc.splitTextToSize(subtitle, maxW);
  doc.text(lines, margin, y);
  y += lines.length * 4.5 + 3;

  autoTable(doc, {
    startY: y,
    head: [["", "Carta", "Idioma", "Rareza", "Unidades"]],
    body: rows.map((r) => ["", r.name, r.language, r.rareza, String(r.units)]),
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      valign: "middle",
      overflow: "linebreak",
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      minCellHeight: 22,
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 24 },
      3: { halign: "center", cellWidth: 30 },
      4: { halign: "right", cellWidth: 22 },
    },
    margin: { left: margin, right: margin },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawCell: (data) => {
      if (data.column.index !== 0 || data.section !== "body") return;
      const pad = 1;
      const x = data.cell.x + pad;
      const cellY = data.cell.y + pad;
      const width = data.cell.width - pad * 2;
      const height = data.cell.height - pad * 2;
      const imageDataUrl = imageDataUrls[data.row.index];
      if (imageDataUrl) {
        try {
          doc.addImage(imageDataUrl, pdfImageFormat(imageDataUrl), x, cellY, width, height);
          return;
        } catch {
          /* placeholder */
        }
      }
      drawPlaceholder(doc, x, cellY, width, height);
    },
  });

  doc.save(opts?.filename ?? buildSentUnitsPdfFilename());
  return { rows: rows.length, units: totalU, imageFailures };
}
