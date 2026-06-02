import { describe, expect, it } from "vitest";
import {
  countPedidoLinesByStatus,
  isPedidoLinePending,
  parseCardtraderPedidoPaste,
  parseMaxUsdFromNotes,
  pedidoQtyToAddFromOffer,
  slugToDisplayName,
} from "./parse-cardtrader-pedido";

describe("parseCardtraderPedidoPaste", () => {
  it("parsea cantidad, URL y notas en la misma línea", () => {
    const lines = parseCardtraderPedidoPaste(
      "X2 https://www.cardtrader.com/es/cards/225675-venusaur-v-100-swsh-black-star-promos",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      quantity: 2,
      blueprintId: 225675,
      lineNumber: 1,
    });
    expect(lines[0].url).toContain("225675");
  });

  it("extrae notas del cliente antes de la URL", () => {
    const lines = parseCardtraderPedidoPaste(
      "(NO IMPORTA MAL ESTADO) https://www.cardtrader.com/es/cards/127768-staryu-104-144-skyridge",
    );
    expect(lines[0].clientNotes).toContain("NO IMPORTA MAL ESTADO");
  });

  it("detecta varias líneas en orden", () => {
    const text = `https://www.cardtrader.com/es/cards/100-a
X2 https://www.cardtrader.com/es/cards/200-b
(SP/MP MENOR DE $2.50) https://www.cardtrader.com/es/cards/300-c`;
    const lines = parseCardtraderPedidoPaste(text);
    expect(lines).toHaveLength(3);
    expect(lines[1].quantity).toBe(2);
    expect(lines[2].maxUsdHint).toBe(2.5);
  });
});

describe("parseMaxUsdFromNotes", () => {
  it("lee tope en dólares", () => {
    expect(parseMaxUsdFromNotes("SP/MP MENOR DE $2.50")).toBe(2.5);
    expect(parseMaxUsdFromNotes("FIRST EDITION INFERIOR A $3")).toBe(3);
  });
});

describe("slugToDisplayName", () => {
  it("humaniza el slug", () => {
    expect(slugToDisplayName("venusaur-v-100-swsh-black-star-promos")).toContain("Venusaur");
  });
});

describe("pedido cantidad parcial", () => {
  const line = {
    id: "line-1-1",
    lineNumber: 1,
    quantity: 3,
    blueprintId: 1,
    slug: "x",
    displayName: "X",
    url: "https://example.com",
    clientNotes: "",
    maxUsdHint: null,
  };

  it("pedidoQtyToAddFromOffer respeta stock y faltantes", () => {
    expect(pedidoQtyToAddFromOffer(line, {}, 1)).toBe(1);
    expect(pedidoQtyToAddFromOffer(line, { "line-1-1": 2 }, 5)).toBe(1);
    expect(pedidoQtyToAddFromOffer(line, {}, 0)).toBe(0);
  });

  it("pedidoQtyToAddFromOffer permite solo 1 extra si el pedido ya está completo", () => {
    expect(pedidoQtyToAddFromOffer(line, { "line-1-1": 3 }, 5)).toBe(1);
    expect(pedidoQtyToAddFromOffer(line, { "line-1-1": 3 }, 0)).toBe(0);
  });

  it("isPedidoLinePending con añadidos parciales", () => {
    expect(isPedidoLinePending(line, {}, {})).toBe(true);
    expect(isPedidoLinePending(line, {}, { "line-1-1": 2 })).toBe(true);
    expect(isPedidoLinePending(line, { "line-1-1": "in_cart" }, { "line-1-1": 3 })).toBe(false);
    expect(isPedidoLinePending(line, { "line-1-1": "skipped" }, {})).toBe(false);
  });

  it("countPedidoLinesByStatus cuenta parcial como pendiente", () => {
    const counts = countPedidoLinesByStatus([line], {}, { "line-1-1": 1 });
    expect(counts.pending).toBe(1);
    expect(counts.done).toBe(0);
    const done = countPedidoLinesByStatus([line], {}, { "line-1-1": 3 });
    expect(done.pending).toBe(0);
    expect(done.done).toBe(1);
  });
});
