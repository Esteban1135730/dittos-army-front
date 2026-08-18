import { describe, expect, it } from "vitest";
import type { PedidoItem } from "./pedido-types";
import {
  descripcionEntrega,
  formatFechaTentativa,
  pedidoStatusLabel,
} from "./pedido-entrega-label";

function pedido(partial: Partial<PedidoItem>): PedidoItem {
  return {
    id: "p1",
    _id: "p1",
    client_id: "c1",
    status: "reservado",
    entrega_en_tienda: true,
    fecha_tentativa_entrega: "2026-08-20",
    lines: [],
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("descripcionEntrega", () => {
  it("tienda: nombre + dirección", () => {
    expect(
      descripcionEntrega(
        pedido({
          entrega_en_tienda: true,
          store_name: "Valhalla",
          store_address: "Cl. 150 #16-56 local 2074, CC Cedritos, Bogotá",
        }),
      ),
    ).toBe("Valhalla — Cl. 150 #16-56 local 2074, CC Cedritos, Bogotá");
  });

  it("envío: ciudad + punto", () => {
    expect(
      descripcionEntrega(
        pedido({
          entrega_en_tienda: false,
          ciudad: "Medellín",
          direccion_o_punto: "Calle 10 #5-20",
          notas_entrega: "Portería",
        }),
      ),
    ).toBe("Medellín · Calle 10 #5-20 · Portería");
  });

  it("vacío si no hay pedido", () => {
    expect(descripcionEntrega(undefined)).toBe("");
    expect(descripcionEntrega(null)).toBe("");
  });
});

describe("formatFechaTentativa", () => {
  it("formatea YYYY-MM-DD en es-CO short", () => {
    expect(formatFechaTentativa("2026-08-20")).toMatch(/\d/);
  });

  it("nula o inválida", () => {
    expect(formatFechaTentativa(null)).toBe("Sin fecha tentativa");
    expect(formatFechaTentativa("")).toBe("Sin fecha tentativa");
  });
});

describe("pedidoStatusLabel", () => {
  it("usa texto, no solo color", () => {
    expect(pedidoStatusLabel("reservado")).toBe("Reservado");
    expect(pedidoStatusLabel("pagado")).toBe("Pagado");
    expect(pedidoStatusLabel("entregado")).toBe("Entregado");
  });
});
