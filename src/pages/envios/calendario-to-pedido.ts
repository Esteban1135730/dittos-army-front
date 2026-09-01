import type { PedidoItem } from "../clientes/pedido-types";
import type { PedidoCalendarioItem } from "./types";

/** Stub para NuevoPedidoDialog: el calendario no trae `lines`. */
export function calendarioToPedidoItem(item: PedidoCalendarioItem): PedidoItem {
  return {
    id: item.id,
    _id: item.id,
    client_id: item.client_id,
    status: item.status,
    entrega_en_tienda: item.entrega_en_tienda,
    store_id: item.store_id,
    store_name: item.store_name,
    store_address: item.store_address,
    ciudad: item.ciudad,
    direccion_o_punto: item.direccion_o_punto,
    notas_entrega: item.notas_entrega,
    fecha_tentativa_entrega: item.fecha_tentativa_entrega,
    lines: [],
    created_at: "",
    updated_at: "",
  };
}
