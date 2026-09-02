import { apiUrl } from "../../config/api";

export const API_PEDIDO = apiUrl("/pedido");

export type PedidoStatus = "reservado" | "pagado" | "entregado";

export type PedidoLine = {
  stock_id: string;
  card_id: string;
  card_name?: string;
  precio: number;
  currency: string;
  image_url?: string;
  quantity?: number;
};

export type PedidoItem = {
  id: string;
  _id: string;
  client_id: string;
  status: PedidoStatus;
  entrega_en_tienda: boolean;
  store_id?: string;
  store_name?: string;
  store_address?: string;
  ciudad?: string;
  direccion_o_punto?: string;
  notas_entrega?: string;
  fecha_tentativa_entrega: string | null;
  paid_at?: string | null;
  delivered_at?: string | null;
  lines: PedidoLine[];
  created_at: string;
  updated_at: string;
};

export type TiendaEntregaCatalogItem = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
};

export type PedidoWriteBody = {
  client_id?: string;
  entrega_en_tienda: boolean;
  store_id?: string;
  ciudad?: string;
  direccion_o_punto?: string;
  notas_entrega?: string;
  fecha_tentativa_entrega?: string;
};

export function pedidoId(p: PedidoItem): string {
  return p.id || p._id;
}

export function findPedidoReservado(pedidos: PedidoItem[]): PedidoItem | undefined {
  return pedidos.find((p) => p.status === "reservado");
}

export function findPedidoAbierto(pedidos: PedidoItem[]): PedidoItem | undefined {
  return pedidos.find((p) => p.status === "reservado" || p.status === "pagado");
}

export function canReservarStock(openPedido: PedidoItem | undefined): boolean {
  return openPedido?.status === "reservado";
}

/**
 * Líneas de stock que pertenecen a un pedido.
 * Las reservas sin `pedido_id` (legado / materializadas) se incluyen solo si `includeOrphans`.
 */
export function filterReservasDePedido<T extends { pedido_id?: string }>(
  reservas: T[],
  targetPedidoId: string | undefined,
  includeOrphans: boolean,
): T[] {
  const target = targetPedidoId?.trim() ?? "";
  return reservas.filter((r) => {
    const pid = r.pedido_id?.trim() ?? "";
    if (!pid) return includeOrphans;
    return Boolean(target) && pid === target;
  });
}
