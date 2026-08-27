import { describe, expect, it } from "vitest";
import {
  groupReservasForPrint,
  pickPedidoForPrintCard,
} from "./group-reservas-for-print";
import type { ReservaItem } from "./cliente-types";
import type { PedidoItem } from "./pedido-types";

const reserva = (
  partial: Pick<ReservaItem, "client_id"> & Partial<ReservaItem>,
): ReservaItem => ({
  _id: partial._id ?? "r1",
  client_id: partial.client_id,
  stock_id: partial.stock_id ?? "s1",
  precio: partial.precio ?? 1000,
  currency: partial.currency ?? "COP",
  pedido_id: partial.pedido_id,
  quantity: partial.quantity,
});

const pedido = (id: string, status: PedidoItem["status"]): PedidoItem =>
  ({
    id,
    _id: id,
    client_id: "c1",
    status,
    entrega_en_tienda: true,
    fecha_tentativa_entrega: null,
    lines: [],
    created_at: "",
    updated_at: "",
  }) as PedidoItem;

describe("groupReservasForPrint", () => {
  it("agrupa por cliente aunque haya pedido_id y reservas legado", () => {
    const groups = groupReservasForPrint([
      reserva({ _id: "a", client_id: "c1", pedido_id: "p1" }),
      reserva({ _id: "b", client_id: "c1" }),
      reserva({ _id: "c", client_id: "c2", pedido_id: "p2" }),
    ]);
    expect(groups).toHaveLength(2);
    const c1 = groups.find((g) => g.clientId === "c1");
    expect(c1?.items.map((i) => i._id)).toEqual(["a", "b"]);
    expect(c1?.pedidoIds).toEqual(["p1"]);
  });

  it("no duplica pedido_ids", () => {
    const groups = groupReservasForPrint([
      reserva({ client_id: "c1", pedido_id: " p1 " }),
      reserva({ _id: "x", client_id: "c1", pedido_id: "p1" }),
    ]);
    expect(groups[0]?.pedidoIds).toEqual(["p1"]);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("omite reservas sin client_id", () => {
    expect(groupReservasForPrint([reserva({ client_id: "  " })])).toEqual([]);
  });
});

describe("pickPedidoForPrintCard", () => {
  it("prefiere el pedido abierto", () => {
    const picked = pickPedidoForPrintCard(
      ["old", "open"],
      {
        old: pedido("old", "entregado"),
        open: pedido("open", "reservado"),
      },
    );
    expect(picked?._id).toBe("open");
  });

  it("si no hay abierto, usa el primero cargado", () => {
    const picked = pickPedidoForPrintCard(["a"], {
      a: pedido("a", "entregado"),
    });
    expect(picked?._id).toBe("a");
  });
});
