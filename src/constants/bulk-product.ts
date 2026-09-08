/** SKU fijo de inventario con cantidad (feature 032). Alineado con backend. */

import { apiUrl } from "../config/api";
import { rewriteCardImagesUrl } from "../utils/card-images-url";

export const BULK_CARD_ID = "da-bulk";
export const BULK_CARD_NAME = "bulk";
export const BULK_DEFAULT_QUANTITY = 9999;
export const BULK_DEFAULT_PVP_COP = 2000;
export const BULK_DUMMY_IMAGE_URL = "/bulk-dummy.svg";

/** SKUs quantity de Pablo (PVP 0; precio en cada pedido). */
export const ENVIO_CARD_ID = "da-envio";
export const DOMICILIO_CARD_ID = "da-domicilio";
export const PROTECCION_CARTAS_CARD_ID = "da-proteccion-cartas";

/** Orden fijo al tope del catálogo de reserva/pedido. */
export const RESERVA_PINNED_CARD_IDS = [
  BULK_CARD_ID,
  ENVIO_CARD_ID,
  DOMICILIO_CARD_ID,
  PROTECCION_CARTAS_CARD_ID,
] as const;

export type ProductKind = "unit" | "quantity";

export function isBulkCardId(cardId: string | null | undefined): boolean {
  return String(cardId ?? "").trim() === BULK_CARD_ID;
}

export function reservaCatalogPinRank(cardId: string | null | undefined): number {
  const id = String(cardId ?? "").trim();
  const i = (RESERVA_PINNED_CARD_IDS as readonly string[]).indexOf(id);
  return i === -1 ? RESERVA_PINNED_CARD_IDS.length : i;
}

export function isQuantityProduct(opts: {
  product_kind?: string | null;
  card_id?: string | null;
}): boolean {
  if (String(opts.product_kind ?? "").trim() === "quantity") return true;
  return reservaCatalogPinRank(opts.card_id) < RESERVA_PINNED_CARD_IDS.length;
}

/** URL de imagen para UI: fallback dummy para da-bulk; /card-images vía API. */
export function resolveStockImageUrl(
  cardId: string | null | undefined,
  imageUrl: string | null | undefined,
): string {
  const url = String(imageUrl ?? "").trim();
  if (url) return rewriteCardImagesUrl(url, apiUrl);
  if (reservaCatalogPinRank(cardId) < RESERVA_PINNED_CARD_IDS.length) {
    return BULK_DUMMY_IMAGE_URL;
  }
  return "";
}
