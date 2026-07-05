import type { StockListItem } from "../types/stock";

/** Misma visibilidad que la grilla `/stock` (excluye vendidas y propiedad). */
export function isStockLineVisibleInGrid(
  item: Pick<StockListItem, "card_state">,
): boolean {
  return (
    item.card_state !== "vendida" && item.card_state !== "propiedad"
  );
}

export function filterStockVisibleInGrid<T extends Pick<StockListItem, "card_state">>(
  items: T[],
): T[] {
  return items.filter(isStockLineVisibleInGrid);
}
