/** Línea de pedido pegada desde WhatsApp / texto del cliente (URLs CardTrader). */

export type ParsedPedidoLine = {
  id: string;
  lineNumber: number;
  quantity: number;
  blueprintId: number;
  slug: string;
  displayName: string;
  url: string;
  clientNotes: string;
  /** Límite USD inferido de notas tipo "menor de $7". */
  maxUsdHint: number | null;
};

const CARDTRADER_URL_RE =
  /https?:\/\/(?:www\.)?cardtrader\.com\/(?:es|en)\/cards\/(\d+)-([a-z0-9-]+)/gi;

export function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) return `#${part}`;
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function parseMaxUsdFromNotes(notes: string): number | null {
  const lower = notes.toLowerCase();
  const patterns = [
    /menor\s+(?:de|a)\s+\$?\s*([\d]+(?:[.,]\d+)?)/i,
    /inferior\s+a\s+\$?\s*([\d]+(?:[.,]\d+)?)/i,
    /<\s*\$?\s*([\d]+(?:[.,]\d+)?)/,
    /max(?:imo)?\s+\$?\s*([\d]+(?:[.,]\d+)?)/i,
    /\$\s*([\d]+(?:[.,]\d+)?)\s+o\s+menos/i,
  ];
  for (const re of patterns) {
    const m = lower.match(re) ?? notes.match(re);
    if (m?.[1]) {
      const n = Number(m[1].replace(",", "."));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Convierte texto pegado en líneas ordenadas (cantidad, URL, notas del cliente).
 */
export function parseCardtraderPedidoPaste(raw: string): ParsedPedidoLine[] {
  const lines: ParsedPedidoLine[] = [];
  const text = raw.replace(/\r\n/g, "\n");
  let lineNumber = 0;

  for (const row of text.split("\n")) {
    const trimmed = row.trim();
    if (!trimmed) continue;

    let match: RegExpExecArray | null;
    CARDTRADER_URL_RE.lastIndex = 0;

    while ((match = CARDTRADER_URL_RE.exec(trimmed)) !== null) {
      lineNumber += 1;
      const blueprintId = Number(match[1]);
      const slug = match[2];
      if (!Number.isFinite(blueprintId)) continue;

      const beforeUrl = trimmed.slice(0, match.index).trim();
      const qtyMatch = beforeUrl.match(/x\s*(\d+)\s*$/i);
      const quantity = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : 1;

      let clientNotes = `${beforeUrl} ${trimmed.slice(match.index + match[0].length)}`.trim();
      clientNotes = clientNotes.replace(/x\s*\d+\s*$/i, "").trim();

      const url = match[0];
      lines.push({
        id: `line-${lineNumber}-${blueprintId}`,
        lineNumber,
        quantity,
        blueprintId,
        slug,
        displayName: slugToDisplayName(slug),
        url,
        clientNotes,
        maxUsdHint: parseMaxUsdFromNotes(clientNotes),
      });
    }
  }

  return lines;
}

export function pedidoLineAddedQty(
  addedQtyByLineId: Record<string, number> | undefined,
  lineId: string,
): number {
  const n = addedQtyByLineId?.[lineId];
  return typeof n === "number" && n > 0 ? Math.floor(n) : 0;
}

export function pedidoLineRemainingQty(
  line: Pick<ParsedPedidoLine, "quantity" | "id">,
  addedQtyByLineId: Record<string, number> | undefined,
): number {
  return Math.max(0, line.quantity - pedidoLineAddedQty(addedQtyByLineId, line.id));
}

/** Cuántas unidades se pueden añadir con esta oferta (stock del vendedor; tope pedido si aún faltan). */
export function pedidoQtyToAddFromOffer(
  line: Pick<ParsedPedidoLine, "quantity" | "id">,
  addedQtyByLineId: Record<string, number> | undefined,
  offerStock: number | undefined,
): number {
  const stock = Math.max(0, Math.floor(offerStock ?? 0));
  if (stock <= 0) return 0;
  const remaining = pedidoLineRemainingQty(line, addedQtyByLineId);
  if (remaining > 0) return Math.min(remaining, stock);
  return 1;
}

export function isPedidoLinePending(
  line: ParsedPedidoLine,
  statusById: Record<string, string | undefined>,
  addedQtyByLineId: Record<string, number> | undefined,
): boolean {
  const s = statusById[line.id];
  if (s === "skipped" || s === "done") return false;
  if (s === "in_cart") return false;
  return pedidoLineRemainingQty(line, addedQtyByLineId) > 0;
}

export function countPedidoLinesByStatus(
  lines: ParsedPedidoLine[],
  statusById: Record<string, string>,
  addedQtyByLineId: Record<string, number> = {},
): { pending: number; done: number; skipped: number; total: number } {
  let done = 0;
  let skipped = 0;
  for (const line of lines) {
    const s = statusById[line.id];
    if (s === "skipped") {
      skipped += 1;
      continue;
    }
    if (s === "done" || s === "in_cart" || pedidoLineRemainingQty(line, addedQtyByLineId) === 0) {
      done += 1;
    }
  }
  return {
    total: lines.length,
    done,
    skipped,
    pending: lines.length - done - skipped,
  };
}
