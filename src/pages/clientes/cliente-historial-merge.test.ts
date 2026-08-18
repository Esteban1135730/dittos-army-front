import { describe, expect, it } from "vitest";
import {
  buildHistorialClienteView,
  groupVentasAsPedidosHistoricos,
  saleLinksPedido,
} from "./cliente-historial-merge";
import type { VentaClienteRow } from "./cliente-types";
import type { PedidoItem } from "./pedido-types";

const CLIENT = "507f1f77bcf86cd799439011";
const PEDIDO = "507f1f77bcf86cd799439012";

function venta(partial: Partial<VentaClienteRow> & Pick<VentaClienteRow, "_id">): VentaClienteRow {
  return {
    stock_id: "s1",
    card_id: "sv1-001",
    card_name: "Pikachu",
    amount_cop: 10000,
    created_at: "2026-08-10T15:00:00.000Z",
    ...partial,
  };
}

describe("cliente-historial-merge", () => {
  it("saleLinksPedido detecta id en notas", () => {
    expect(
      saleLinksPedido(
        venta({ _id: "v1", notes: `Venta finalizada desde pedido ${PEDIDO}` }),
        PEDIDO,
      ),
    ).toBe(true);
  });

  it("enriquece pedido entregado sin líneas desde ventas", () => {
    const pedidos: PedidoItem[] = [
      {
        id: PEDIDO,
        _id: PEDIDO,
        client_id: CLIENT,
        status: "entregado",
        entrega_en_tienda: true,
        store_name: "Valhalla",
        fecha_tentativa_entrega: "2026-08-10",
        lines: [],
        created_at: "2026-08-10T12:00:00.000Z",
        updated_at: "2026-08-10T16:00:00.000Z",
        delivered_at: "2026-08-10T16:00:00.000Z",
      },
    ];
    const ventas = [
      venta({
        _id: "v1",
        notes: `pedido ${PEDIDO}`,
        amount_cop: 12000,
      }),
    ];
    const hist = buildHistorialClienteView(pedidos, ventas, CLIENT);
    expect(hist).toHaveLength(1);
    expect(hist[0].lines).toHaveLength(1);
    expect(hist[0].lines[0].precio).toBe(12000);
  });

  it("agrupa ventas huérfanas por día", () => {
    const ventas = [
      venta({ _id: "v1", created_at: "2026-07-01T10:00:00.000Z" }),
      venta({ _id: "v2", created_at: "2026-07-01T11:00:00.000Z" }),
      venta({ _id: "v3", created_at: "2026-07-02T10:00:00.000Z" }),
    ];
    const groups = groupVentasAsPedidosHistoricos(ventas, CLIENT);
    expect(groups).toHaveLength(2);
    expect(groups[0].lines).toHaveLength(1);
    expect(groups[1].lines).toHaveLength(2);
    expect(groups[0].historicoSource).toBe("ventas");
  });
});
