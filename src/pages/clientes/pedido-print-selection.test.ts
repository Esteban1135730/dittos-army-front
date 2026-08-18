import { describe, expect, it } from "vitest";
import { mergePedidoSelection } from "./pedido-print-selection";

describe("mergePedidoSelection", () => {
  it("en la primera carga marca todos los pedidos", () => {
    const { selected, seen } = mergePedidoSelection(new Set(), ["a", "b"], null);
    expect([...selected]).toEqual(["a", "b"]);
    expect([...seen]).toEqual(["a", "b"]);
  });

  it("no vuelve a marcar un pedido que el operador desmarcó", () => {
    const { selected } = mergePedidoSelection(
      new Set(["b"]),
      ["a", "b"],
      new Set(["a", "b"]),
    );
    expect(selected.has("a")).toBe(false);
    expect(selected.has("b")).toBe(true);
  });

  it("marca solo clientes nuevos que aparecen después", () => {
    const { selected } = mergePedidoSelection(
      new Set(["a"]),
      ["a", "b", "c"],
      new Set(["a", "b"]),
    );
    expect([...selected].sort()).toEqual(["a", "c"]);
  });

  it("Deseleccionar todos se mantiene si la lista no cambia", () => {
    const { selected } = mergePedidoSelection(
      new Set(),
      ["a", "b"],
      new Set(["a", "b"]),
    );
    expect(selected.size).toBe(0);
  });
});
