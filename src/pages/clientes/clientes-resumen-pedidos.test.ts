import { describe, expect, it } from "vitest";
import {
  aggregateReservasTotales,
  amountToCop,
  gananciaEstimadaReservaCop,
  type CurrencyConverter,
} from "./clientes-resumen-pedidos";

const convert: CurrencyConverter = {
  toCopFromEur: (value) => value * 5_000,
  toCopFromUsd: (value) => value * 4_000,
};

describe("amountToCop", () => {
  it("devuelve el mismo valor en COP", () => {
    expect(amountToCop(12_000, "COP", convert)).toBe(12_000);
  });

  it("convierte EUR y USD con el conversor", () => {
    expect(amountToCop(10, "EUR", convert)).toBe(50_000);
    expect(amountToCop(10, "USD", convert)).toBe(40_000);
  });
});

describe("gananciaEstimadaReservaCop", () => {
  it("resta el costo de stock en COP", () => {
    expect(
      gananciaEstimadaReservaCop(
        10_000,
        "COP",
        { card_cost: 4_000, currency: "COP" },
        convert,
      ),
    ).toBe(6_000);
  });

  it("trata costo 0 si falta stock", () => {
    expect(gananciaEstimadaReservaCop(5_000, "COP", undefined, convert)).toBe(5_000);
  });

  it("envio conserva el precio y ganancia 0", () => {
    expect(
      gananciaEstimadaReservaCop(
        8_000,
        "COP",
        { card_id: "da-envio", card_cost: 0, currency: "COP" },
        convert,
      ),
    ).toBe(0);
  });
});

describe("aggregateReservasTotales", () => {
  it("suma ventas y ganancia en COP", () => {
    const result = aggregateReservasTotales(
      [
        { stock_id: "s1", precio: 10_000, currency: "COP" },
        { stock_id: "s2", precio: 2, currency: "EUR" },
      ],
      {
        s1: { card_cost: 4_000, currency: "COP" },
        s2: { card_cost: 1, currency: "USD" },
      },
      convert,
    );

    expect(result.ventasEsperadasCop).toBe(20_000);
    expect(result.gananciaEstimadaCop).toBe(12_000);
  });

  it("envio suma ventas esperadas y ganancia 0", () => {
    const result = aggregateReservasTotales(
      [{ stock_id: "d1", precio: 8_000, currency: "COP" }],
      { d1: { card_id: "da-envio", card_cost: 0, currency: "COP" } },
      convert,
    );

    expect(result.ventasEsperadasCop).toBe(8_000);
    expect(result.gananciaEstimadaCop).toBe(0);
  });

  it("trata costo 0 si falta la línea de stock", () => {
    const result = aggregateReservasTotales(
      [{ stock_id: "missing", precio: 5_000, currency: "COP" }],
      {},
      convert,
    );

    expect(result.ventasEsperadasCop).toBe(5_000);
    expect(result.gananciaEstimadaCop).toBe(5_000);
  });

  it("incluye reservas con precio 0", () => {
    const result = aggregateReservasTotales(
      [{ stock_id: "s1", precio: 0, currency: "COP" }],
      { s1: { card_cost: 3_000, currency: "COP" } },
      convert,
    );

    expect(result.ventasEsperadasCop).toBe(0);
    expect(result.gananciaEstimadaCop).toBe(-3_000);
  });

  it("multiplica por quantity en productos bulk", () => {
    const result = aggregateReservasTotales(
      [{ stock_id: "bulk", precio: 2_000, currency: "COP", quantity: 3 }],
      { bulk: { card_cost: 0, currency: "COP" } },
      convert,
    );

    expect(result.ventasEsperadasCop).toBe(6_000);
    expect(result.gananciaEstimadaCop).toBe(6_000);
  });

  it("devuelve ceros sin reservas", () => {
    expect(aggregateReservasTotales([], {}, convert)).toEqual({
      ventasEsperadasCop: 0,
      gananciaEstimadaCop: 0,
    });
  });
});
