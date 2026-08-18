import type { PedidoItem } from "./pedido-types";

export function descripcionEntrega(pedido: PedidoItem | null | undefined): string {
  if (!pedido) return "";
  if (pedido.entrega_en_tienda) {
    const name = pedido.store_name?.trim() ?? "";
    const address = pedido.store_address?.trim() ?? "";
    return [name, address].filter(Boolean).join(" — ");
  }
  const ciudad = pedido.ciudad?.trim() ?? "";
  const punto = pedido.direccion_o_punto?.trim() ?? "";
  const notas = pedido.notas_entrega?.trim() ?? "";
  return [ciudad, punto, notas].filter(Boolean).join(" · ");
}

export function formatFechaTentativa(isoDay: string | null | undefined): string {
  if (!isoDay?.trim()) return "Sin fecha tentativa";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay.trim());
  if (!m) return "Sin fecha tentativa";
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return "Sin fecha tentativa";
  return date.toLocaleDateString("es-CO", { dateStyle: "short" });
}

export function pedidoStatusLabel(status: PedidoItem["status"]): string {
  if (status === "reservado") return "Reservado";
  if (status === "pagado") return "Pagado";
  return "Entregado";
}
