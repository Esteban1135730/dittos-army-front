import type { StockListItem } from "../../types/stock";

const DEFAULT_MAX_RESULTS = 50;
const MIN_QUERY_LENGTH = 2;

/** Mismo criterio de búsqueda que la grilla Stock: solo `card_name`. */
export function filterStockForSearch(
  items: StockListItem[],
  query: string,
  maxResults = DEFAULT_MAX_RESULTS,
): StockListItem[] {
  const term = query.trim().toLowerCase();
  if (term.length < MIN_QUERY_LENGTH) return [];

  return items
    .filter((item) =>
      (item.card_name ?? "").toLowerCase().includes(term),
    )
    .sort((a, b) =>
      (a.card_name ?? "").localeCompare(b.card_name ?? "", "es"),
    )
    .slice(0, maxResults);
}
