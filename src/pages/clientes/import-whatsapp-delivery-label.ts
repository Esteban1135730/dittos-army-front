import type { ImportWhatsAppPedidoAction } from "./cliente-types";

const PEDIDO_ACTION_COPY: Record<ImportWhatsAppPedidoAction, string> = {
  create: "Se creará un pedido con esa tienda y fecha.",
  reuse_reservado:
    "Se usará el pedido reservado abierto; la tienda y fecha del mensaje no se aplican.",
  reservas_only:
    "Solo reservas; sin Pedido. El operador puede crear el pedido después en la ficha.",
  blocked_pagado:
    "Hay un pedido pagado abierto; no se puede importar por esta vía.",
};

export function importWhatsAppPedidoActionCopy(
  action: ImportWhatsAppPedidoAction | undefined,
): string {
  if (!action) return "";
  return PEDIDO_ACTION_COPY[action];
}
