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
