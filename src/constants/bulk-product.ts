/** SKU fijo de inventario con cantidad (feature 032). Alineado con backend. */

export const BULK_CARD_ID = "da-bulk";
export const BULK_CARD_NAME = "bulk";
export const BULK_DEFAULT_QUANTITY = 9999;
export const BULK_DEFAULT_PVP_COP = 2000;
export const BULK_DUMMY_IMAGE_URL = "/bulk-dummy.svg";

export type ProductKind = "unit" | "quantity";

export function isBulkCardId(cardId: string | null | undefined): boolean {
  return String(cardId ?? "").trim() === BULK_CARD_ID;
}

export function isQuantityProduct(opts: {
  product_kind?: string | null;
  card_id?: string | null;
}): boolean {
  if (String(opts.product_kind ?? "").trim() === "quantity") return true;
  return isBulkCardId(opts.card_id);
}

/** URL de imagen para UI: fallback dummy para da-bulk. */
export function resolveStockImageUrl(
  cardId: string | null | undefined,
  imageUrl: string | null | undefined,
): string {
  const url = String(imageUrl ?? "").trim();
  if (url) return url;
  if (isBulkCardId(cardId)) return BULK_DUMMY_IMAGE_URL;
  return "";
}
