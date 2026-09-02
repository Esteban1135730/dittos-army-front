import { describe, expect, it } from "vitest";
import { filterReservasDePedido } from "./pedido-types";

describe("filterReservasDePedido", () => {
  const rows = [
    { _id: "a", pedido_id: "p1" },
    { _id: "b" },
    { _id: "c", pedido_id: "" },
    { _id: "d", pedido_id: "p2" },
  ];

  it("en pedido reservado incluye líneas del pedido y huérfanas", () => {
    expect(filterReservasDePedido(rows, "p1", true).map((r) => r._id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("en pedido pagado no mezcla huérfanas", () => {
    expect(filterReservasDePedido(rows, "p1", false).map((r) => r._id)).toEqual(["a"]);
  });

  it("sin pedido solo muestra huérfanas si includeOrphans", () => {
    expect(filterReservasDePedido(rows, undefined, true).map((r) => r._id)).toEqual([
      "b",
      "c",
    ]);
    expect(filterReservasDePedido(rows, undefined, false)).toEqual([]);
  });
});
