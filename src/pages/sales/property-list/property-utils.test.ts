import { describe, expect, it } from "vitest";
import { propertyCostInCop } from "./property-utils";

describe("property-utils", () => {
  const convert = {
    toCopFromEur: (n: number) => n * 5000,
    toCopFromUsd: (n: number) => n * 4500,
  };

  it("propertyCostInCop convierte EUR y USD", () => {
    expect(
      propertyCostInCop({ card_cost: 10, currency: "EUR" } as never, convert),
    ).toBe(50000);
    expect(
      propertyCostInCop({ card_cost: 1000, currency: "COP" } as never, convert),
    ).toBe(1000);
  });
});
