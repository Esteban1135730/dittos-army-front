import type { StockScanView, StockSellRejectReason } from "./types";

const REJECT_MESSAGES: Record<StockSellRejectReason, string> = {
  sin_pvp: "Esta carta no tiene PVP asignado.",
  estado_no_vendible: "Estado de stock no vendible.",
  ya_vendida: "Esta carta ya está vendida.",
  reservada: "Esta carta está reservada.",
  propiedad: "Esta carta está en propiedad.",
  sin_stock: "Sin unidades disponibles.",
};

export function rejectReasonMessage(reason?: StockSellRejectReason): string {
  if (!reason) return "No se puede añadir al carrito.";
  return REJECT_MESSAGES[reason] ?? "No se puede añadir al carrito.";
}

export type ReservedScanNotice = {
  severity: "info" | "warning" | "success";
  message: string;
};

/** Último recurso: no hay otra unidad vendible (no es un duplicado prematuro). */
export const NO_MORE_COPIES_MESSAGE = "No quedan más copias disponibles.";

export function scanRejectMessage(
  view: Pick<StockScanView, "reject_reason" | "product_kind">,
  opts: { requestedId: string; excludeIds: string[] },
): string {
  const unit = (view.product_kind ?? "unit") !== "quantity";
  const requested = opts.requestedId.trim();
  const wasExcluded =
    requested.length > 0 &&
    opts.excludeIds.some((id) => id.trim() === requested);
  if (unit && wasExcluded) return NO_MORE_COPIES_MESSAGE;
  return rejectReasonMessage(view.reject_reason);
}

/** Si addLine aún devuelve duplicate en una unidad, no bloquear como "ya está en el carrito". */
export function duplicateUnitScanMessage(
  productKind?: "unit" | "quantity",
): string {
  if (productKind === "quantity") return "No se puede añadir al carrito.";
  return NO_MORE_COPIES_MESSAGE;
}

/** Aviso a mostrar tras un scan con sustitución o fallback (reserva / vendida / copia). */
export function reservedScanNotice(
  view: Partial<
    Pick<
      StockScanView,
      | "substituted"
      | "reserved_fallback"
      | "sold_language_fallback"
      | "copy_fallback"
      | "language"
    >
  >,
): ReservedScanNotice | null {
  if (view.sold_language_fallback) {
    const lang = (view.language ?? "").trim() || "?";
    return {
      severity: "warning",
      message: `La carta escaneada ya estaba vendida; se cargó la misma carta en ${lang}.`,
    };
  }
  if (view.copy_fallback) {
    const lang = (view.language ?? "").trim();
    const named = lang.length > 0 && lang !== "—" && lang !== "?";
    return {
      severity: "success",
      message: named
        ? `Se agregó otra copia disponible (${lang}).`
        : "Se agregó otra copia disponible.",
    };
  }
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
