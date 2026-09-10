import { describe, expect, it } from "vitest";
import { stockRowsFromQueryData } from "./stock-query-rows";

describe("stockRowsFromQueryData", () => {
  it("acepta el array que guardan Reservar cartas y etiquetas QR", () => {
    const rows = stockRowsFromQueryData([
      { _id: "a", card_name: "Pikachu" },
    ]);
    expect(rows).toEqual([{ _id: "a", card_name: "Pikachu" }]);
  });

  it("acepta el objeto { items } de caché vieja de imprimir pedidos", () => {
    const rows = stockRowsFromQueryData({
      owner: "pablo",
      items: [{ _id: "b", card_name: "Mew" }],
    });
    expect(rows).toEqual([{ _id: "b", card_name: "Mew" }]);
  });

  it("no itera si data es undefined", () => {
    expect(stockRowsFromQueryData(undefined)).toEqual([]);
  });
});
