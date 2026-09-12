import { isOwnerKey, type OwnerKey } from "../../config/owners";
import { resolveStockImageUrl } from "../../constants/bulk-product";
import type { StockListItem } from "../../types/stock";
import type { PedidoLine } from "./pedido-types";
import type { TcgdexCardDetail } from "./tcgdex-card-detail";

export function resolveReservaOwner(
  stockOwner: string | null | undefined,
  activeOwner: OwnerKey,
): OwnerKey {
  return isOwnerKey(stockOwner) ? stockOwner : activeOwner;
}

export function stockOwnerKey(owner: OwnerKey, stockId: string): string {
  return `${owner}:${stockId}`;
}

export function buildStockByOwnerId<T extends { _id: string }>(
  groups: Array<{ owner: OwnerKey; rows: T[] }>,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const { owner, rows } of groups) {
    for (const row of rows) {
      if (!row._id) continue;
      map.set(stockOwnerKey(owner, row._id), row);
    }
  }
  return map;
}

export function lookupStockForReserva<T>(
  stockByOwnerId: Map<string, T>,
  stockId: string | null | undefined,
  stockOwner: string | null | undefined,
  activeOwner: OwnerKey,
): T | undefined {
  const id = String(stockId ?? "").trim();
  if (!id) return undefined;
  const owner = resolveReservaOwner(stockOwner, activeOwner);
  return stockByOwnerId.get(stockOwnerKey(owner, id));
}

export function findPedidoLineByStockId(
  lines: PedidoLine[] | undefined,
  stockId: string,
): PedidoLine | undefined {
  const id = String(stockId ?? "").trim();
  if (!id || !lines?.length) return undefined;
  return lines.find((l) => l.stock_id === id);
}

export type PedidoReservaVisualInput = {
  stock?: Pick<StockListItem, "card_id" | "card_name" | "image_url" | "rareza">;
  pedidoLine?: Pick<PedidoLine, "card_id" | "card_name" | "image_url">;
  tcg?: Pick<TcgdexCardDetail, "name" | "imageUrl">;
  stockOwner?: string | null;
  activeOwner: OwnerKey;
};

export type PedidoReservaVisual = {
  cardId: string;
  cardName: string;
  imageSrc: string;
  rareza?: string | null;
  lineOwner: OwnerKey;
};

/** Miniatura y nombre: stock del owner → línea denormalizada → TCGdex. */
export function resolvePedidoReservaVisual(
  input: PedidoReservaVisualInput,
): PedidoReservaVisual {
  const lineOwner = resolveReservaOwner(input.stockOwner, input.activeOwner);
  const cardId =
    input.stock?.card_id?.trim() ||
    input.pedidoLine?.card_id?.trim() ||
    "";
  const cardName =
    input.stock?.card_name?.trim() ||
    input.pedidoLine?.card_name?.trim() ||
    input.tcg?.name?.trim() ||
    "Carta";
  const storedImage = input.stock?.image_url || input.pedidoLine?.image_url;
  const fromStockOrLine = resolveStockImageUrl(cardId, storedImage);
  const imageSrc =
    fromStockOrLine || resolveStockImageUrl(cardId, input.tcg?.imageUrl);
  return {
    cardId,
    cardName,
    imageSrc,
    rareza: input.stock?.rareza,
    lineOwner,
  };
}
