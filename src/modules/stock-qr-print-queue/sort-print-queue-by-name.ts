import type { PrintQueueEntry } from "./types";

const LOCALE_ES = "es";

function nameOf(
  stockId: string,
  nameByStockId: ReadonlyMap<string, string>,
): string {
  return (nameByStockId.get(stockId) ?? "").trim();
}

/**
 * Ordena la cola por nombre de carta (es, sin distinguir mayúsculas).
 * Sin nombre van al final; empate se desempata por `stockId`.
 */
export function sortPrintQueueByName(
  queue: readonly PrintQueueEntry[],
  nameByStockId: ReadonlyMap<string, string>,
): PrintQueueEntry[] {
  return [...queue].sort((a, b) => {
    const na = nameOf(a.stockId, nameByStockId);
    const nb = nameOf(b.stockId, nameByStockId);
    if (!na && nb) return 1;
    if (na && !nb) return -1;
    const byName = na.localeCompare(nb, LOCALE_ES, {
      sensitivity: "base",
      numeric: true,
    });
    if (byName !== 0) return byName;
    return a.stockId.localeCompare(b.stockId);
  });
}
