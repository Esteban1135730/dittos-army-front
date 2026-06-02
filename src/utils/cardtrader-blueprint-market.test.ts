import { describe, expect, it } from "vitest";
import {
  blueprintMatchesPriceFilter,
  blueprintMatchesRarityFilter,
  compareBlueprintsByMarketPrice,
  extractBlueprintListPrice,
  extractBlueprintRarity,
  formatBlueprintMarketPrice,
  marketPriceToUsdCents,
  minPricesByBlueprintFromMarketplace,
  parseUsdFilterToCents,
} from "./cardtrader-blueprint-market";

describe("minPricesByBlueprintFromMarketplace", () => {
  it("toma el primer producto (más barato) de cada blueprint", () => {
    const map = minPricesByBlueprintFromMarketplace({
      "10": [{ price: { cents: 50, currency: "USD", formatted: "$0.50" } }],
      "20": [
        { price_cents: 120, price_currency: "EUR" },
        { price_cents: 200, price_currency: "EUR" },
      ],
    });
    expect(map.get(10)).toMatchObject({ cents: 50, currency: "USD" });
    expect(map.get(20)).toMatchObject({ cents: 120, currency: "EUR" });
  });
});

describe("extractBlueprintListPrice", () => {
  it("lee price.cents del blueprint", () => {
    expect(
      extractBlueprintListPrice({
        id: 1,
        price: { cents: 99, currency: "USD", formatted: "$0.99" },
      }),
    ).toMatchObject({ cents: 99, currency: "USD" });
  });
});

describe("formatBlueprintMarketPrice", () => {
  it("prefiere formatted", () => {
    expect(
      formatBlueprintMarketPrice({ cents: 40, currency: "USD", formatted: "$0.40" }),
    ).toBe("$0.40");
  });
});

describe("compareBlueprintsByMarketPrice", () => {
  it("ordena por precio y luego por nombre", () => {
    const prices = new Map([
      [1, { cents: 100, currency: "USD" }],
      [2, { cents: 50, currency: "USD" }],
    ]);
    expect(compareBlueprintsByMarketPrice(1, 2, prices, "Zard", "Abra")).toBeGreaterThan(0);
    expect(compareBlueprintsByMarketPrice(2, 1, prices, "Abra", "Zard")).toBeLessThan(0);
  });

  it("ordena descendente cuando se indica", () => {
    const prices = new Map([
      [1, { cents: 100, currency: "USD" }],
      [2, { cents: 50, currency: "USD" }],
    ]);
    expect(
      compareBlueprintsByMarketPrice(1, 2, prices, "Zard", "Abra", { direction: "desc" }),
    ).toBeLessThan(0);
  });
});

describe("extractBlueprintRarity", () => {
  it("lee pokemon_rarity de fixed_properties", () => {
    expect(
      extractBlueprintRarity({
        fixed_properties: { pokemon_rarity: "Rare Holo" },
      }),
    ).toBe("Rare Holo");
  });
});

describe("blueprintMatchesPriceFilter", () => {
  it("respeta rango en centavos USD", () => {
    expect(blueprintMatchesPriceFilter(150, 100, 200)).toBe(true);
    expect(blueprintMatchesPriceFilter(50, 100, null)).toBe(false);
  });
});

describe("blueprintMatchesRarityFilter", () => {
  it("filtra por rareza normalizada", () => {
    expect(blueprintMatchesRarityFilter("Rare Holo", ["rare holo"])).toBe(true);
    expect(blueprintMatchesRarityFilter("Common", ["Rare"])).toBe(false);
  });
});

describe("parseUsdFilterToCents", () => {
  it("parsea dólares a centavos", () => {
    expect(parseUsdFilterToCents("1.5")).toBe(150);
  });
});

describe("marketPriceToUsdCents", () => {
  it("deja USD sin convertir", () => {
    expect(marketPriceToUsdCents({ cents: 99, currency: "USD" }, 4000)).toBe(99);
  });
});
