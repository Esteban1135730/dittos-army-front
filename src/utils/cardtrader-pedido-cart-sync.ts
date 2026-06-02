import type { CardtraderCartItemMeta } from "./cardtrader-cart-meta-cache";
import type { PedidoLineStatus } from "./cardtrader-pedido-progress-cache";
import type { ParsedPedidoLine } from "./parse-cardtrader-pedido";

/** Cantidad en carrito agrupada por blueprint (todas las ofertas del mismo blueprint). */
export function blueprintQtyInCart(
  cart: unknown,
  metaByProductId: Record<number, CardtraderCartItemMeta> = {},
): Map<number, number> {
  const totals = new Map<number, number>();
  if (!cart || typeof cart !== "object") return totals;

  const subcarts = (cart as { subcarts?: unknown[] }).subcarts;
  if (!Array.isArray(subcarts)) return totals;

  for (const sc of subcarts) {
    if (!sc || typeof sc !== "object") continue;
    const items = (sc as { cart_items?: unknown[] }).cart_items;
    if (!Array.isArray(items)) continue;

    for (const ci of items) {
      if (!ci || typeof ci !== "object") continue;
      const row = ci as {
        quantity?: number;
        product?: {
          id?: number | string;
          blueprint_id?: number;
          marketplace_meta?: { blueprint_id?: number };
        };
      };

      const rawId = row.product?.id;
      const productId =
        typeof rawId === "number" ? rawId : typeof rawId === "string" ? Number(rawId) : NaN;
      const qty = Math.max(0, Math.floor(row.quantity ?? 0));
      if (!Number.isFinite(productId) || qty <= 0) continue;

      const blueprintId =
        row.product?.marketplace_meta?.blueprint_id ??
        row.product?.blueprint_id ??
        metaByProductId[productId]?.blueprintId;

      if (typeof blueprintId !== "number" || !Number.isFinite(blueprintId)) continue;
      totals.set(blueprintId, (totals.get(blueprintId) ?? 0) + qty);
    }
  }

  return totals;
}

/** Reparte unidades del carrito a líneas del pedido en orden (misma blueprint puede repetirse). */
export function allocatePedidoAddedFromCart(
  lines: ParsedPedidoLine[],
  cartByBlueprint: Map<number, number>,
): Record<string, number> {
  const remaining = new Map(cartByBlueprint);
  const out: Record<string, number> = {};

  for (const line of lines) {
    const avail = remaining.get(line.blueprintId) ?? 0;
    const alloc = Math.min(line.quantity, Math.max(0, avail));
    out[line.id] = alloc;
    remaining.set(line.blueprintId, Math.max(0, avail - alloc));
  }

  return out;
}

export type PedidoCartSyncResult = {
  addedQtyByLineId: Record<string, number>;
  statusByLineId: Record<string, PedidoLineStatus>;
};

export function syncPedidoProgressFromCart(
  lines: ParsedPedidoLine[],
  cart: unknown,
  metaByProductId: Record<number, CardtraderCartItemMeta>,
  currentStatus: Record<string, PedidoLineStatus>,
): PedidoCartSyncResult {
  const cartByBlueprint = blueprintQtyInCart(cart, metaByProductId);
  const allocated = allocatePedidoAddedFromCart(lines, cartByBlueprint);

  const addedQtyByLineId: Record<string, number> = {};
  const statusByLineId: Record<string, PedidoLineStatus> = { ...currentStatus };

  for (const line of lines) {
    const status = currentStatus[line.id];

    if (status === "skipped") {
      continue;
    }

    if (status === "done") {
      addedQtyByLineId[line.id] = line.quantity;
      continue;
    }

    const inCart = allocated[line.id] ?? 0;
    addedQtyByLineId[line.id] = inCart;

    if (inCart >= line.quantity) {
      statusByLineId[line.id] = "in_cart";
    } else if (status === "in_cart") {
      statusByLineId[line.id] = "pending";
    } else if (!status) {
      statusByLineId[line.id] = "pending";
    }
  }

  return { addedQtyByLineId, statusByLineId };
}

export function pedidoProgressChanged(
  lines: ParsedPedidoLine[],
  prevAdded: Record<string, number>,
  nextAdded: Record<string, number>,
  prevStatus: Record<string, PedidoLineStatus>,
  nextStatus: Record<string, PedidoLineStatus>,
): boolean {
  for (const line of lines) {
    if ((prevAdded[line.id] ?? 0) !== (nextAdded[line.id] ?? 0)) return true;
    if ((prevStatus[line.id] ?? "pending") !== (nextStatus[line.id] ?? "pending")) return true;
  }
  return false;
}
