import { describe, expect, it } from "vitest";
import {
  gananciaCopFromPvp,
  parseDraftPvpCop,
  stockCostCop,
} from "./receipt-pvp-ganancia";

const convert = {
  toCopFromEur: (n: number) => n * 4000,
  toCopFromUsd: (n: number) => n * 3800,
};

describe("parseDraftPvpCop", () => {
  it("redondea PVP válido", () => {
    expect(parseDraftPvpCop("12500.4")).toBe(12500);
  });

  it("vacío o inválido es 0", () => {
    expect(parseDraftPvpCop("")).toBe(0);
    expect(parseDraftPvpCop("abc")).toBe(0);
  });
});

describe("stockCostCop", () => {
  it("usa card_cost en COP", () => {
    expect(
      stockCostCop(
        { card_cost: 8000, unity_cost: 5000, currency: "COP" },
        convert,
      ),
    ).toBe(8000);
  });

  it("convierte EUR", () => {
    expect(
      stockCostCop(
        { card_cost: 2, unity_cost: 1, currency: "EUR" },
        convert,
      ),
    ).toBe(8000);
  });
});

describe("gananciaCopFromPvp", () => {
  it("PVP menos costo", () => {
    expect(gananciaCopFromPvp(12000, 8000)).toBe(4000);
  });

  it("sin PVP no calcula", () => {
    expect(gananciaCopFromPvp(0, 8000)).toBeNull();
  });
});
