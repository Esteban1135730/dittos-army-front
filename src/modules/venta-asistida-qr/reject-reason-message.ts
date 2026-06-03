import type { StockSellRejectReason } from "./types";

const REJECT_MESSAGES: Record<StockSellRejectReason, string> = {
  sin_pvp: "Esta carta no tiene PVP asignado.",
  estado_no_vendible: "Estado de stock no vendible.",
  ya_vendida: "Esta carta ya está vendida.",
  reservada: "Esta carta está reservada.",
  propiedad: "Esta carta está en propiedad.",
};

export function rejectReasonMessage(reason?: StockSellRejectReason): string {
  if (!reason) return "No se puede añadir al carrito.";
  return REJECT_MESSAGES[reason] ?? "No se puede añadir al carrito.";
}
