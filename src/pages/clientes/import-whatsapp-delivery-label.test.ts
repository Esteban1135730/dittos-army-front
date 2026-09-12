import { describe, expect, it } from "vitest";
import { importWhatsAppPedidoActionCopy } from "./import-whatsapp-delivery-label";

describe("importWhatsAppPedidoActionCopy", () => {
  it("describe cada pedido_action", () => {
    expect(importWhatsAppPedidoActionCopy("create")).toBe(
      "Se creará un pedido con esa tienda y fecha.",
    );
    expect(importWhatsAppPedidoActionCopy("reuse_reservado")).toBe(
      "Se usará el pedido reservado abierto; la tienda y fecha del mensaje no se aplican.",
    );
    expect(importWhatsAppPedidoActionCopy("reservas_only")).toBe(
      "Solo reservas; sin Pedido. El operador puede crear el pedido después en la ficha.",
    );
    expect(importWhatsAppPedidoActionCopy("blocked_pagado")).toBe(
      "Hay un pedido pagado abierto; no se puede importar por esta vía.",
    );
  });

  it("devuelve vacío si no hay acción", () => {
    expect(importWhatsAppPedidoActionCopy(undefined)).toBe("");
  });
});
