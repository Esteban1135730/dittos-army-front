import type { StockScanView, StockSellRejectReason } from "./types";

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

export type ReservedScanNotice = {
  severity: "info" | "warning";
  message: string;
};

/** Aviso a mostrar cuando el scan proviene de una línea reservada (delta 2026-07). */
export function reservedScanNotice(
  view: Pick<StockScanView, "substituted" | "reserved_fallback">,
): ReservedScanNotice | null {
  if (view.substituted) {
    return {
      severity: "info",
      message:
        "La carta escaneada está reservada; se agregó otra copia disponible.",
    };
  }
  if (view.reserved_fallback) {
    return {
      severity: "warning",
      message:
        "Carta reservada: al venderla se cancelará la reserva del cliente.",
    };
  }
  return null;
}
