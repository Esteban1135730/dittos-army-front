import {
  isBulkCardId,
  isQuantityProduct,
} from "../constants/bulk-product";
import type { StockListItem } from "../types/stock";

/** Líneas que se pueden añadir al pedido (catálogo de /clientes/:id/reservar). */
export function isStockLineInReservaCatalog(
  item: Pick<
    StockListItem,
    "card_state" | "product_kind" | "card_id" | "quantity"
  >,
): boolean {
  if (item.card_state === "vendida" || item.card_state === "propiedad") {
    return false;
  }
  if (
    isQuantityProduct({
      product_kind: item.product_kind,
      card_id: item.card_id,
    })
  ) {
    return typeof item.quantity === "number" ? item.quantity > 0 : false;
  }
  return item.card_state !== "reserva";
}

export function filterStockInReservaCatalog<
  T extends Pick<StockListItem, "card_state" | "product_kind" | "card_id" | "quantity">,
>(items: T[]): T[] {
  return items.filter(isStockLineInReservaCatalog);
}

/** El SKU bulk va primero para no perderlo en la paginación. */
export function sortReservaCatalogRows<T extends Pick<StockListItem, "card_id">>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aBulk = isBulkCardId(a.card_id) ? 0 : 1;
    const bBulk = isBulkCardId(b.card_id) ? 0 : 1;
    return aBulk - bBulk;
  });
}
