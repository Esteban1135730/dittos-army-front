import type { ReservaItem } from "./cliente-types";
import { findPedidoAbierto, type PedidoItem } from "./pedido-types";

export type ReservaPrintGroup = {
  clientId: string;
  pedidoIds: string[];
  items: ReservaItem[];
};

/**
 * Un cliente = una tarjeta de impresión.
 * Mezcla reservas con y sin `pedido_id` (legado) en el mismo grupo.
 */
export function groupReservasForPrint(
  reservas: readonly ReservaItem[],
): ReservaPrintGroup[] {
  const map = new Map<string, { items: ReservaItem[]; pedidoIds: string[] }>();

  for (const reserva of reservas) {
    const clientId = String(reserva.client_id ?? "").trim();
    if (!clientId) continue;
    let group = map.get(clientId);
    if (!group) {
      group = { items: [], pedidoIds: [] };
      map.set(clientId, group);
    }
    group.items.push(reserva);
    const pedidoId = reserva.pedido_id?.trim();
    if (pedidoId && !group.pedidoIds.includes(pedidoId)) {
      group.pedidoIds.push(pedidoId);
    }
  }

  return [...map.entries()].map(([clientId, group]) => ({
    clientId,
    pedidoIds: group.pedidoIds,
    items: group.items,
  }));
}

export function pickPedidoForPrintCard(
  pedidoIds: readonly string[],
  pedidoById: Record<string, PedidoItem | undefined>,
): PedidoItem | undefined {
  const loaded = pedidoIds
    .map((id) => pedidoById[id])
    .filter((p): p is PedidoItem => p != null);
  return findPedidoAbierto(loaded) ?? loaded[0];
}
