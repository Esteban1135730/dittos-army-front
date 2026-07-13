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
  it("toma el primer producto (más barato) de cada blueprint usando price.{cents,currency}", () => {
    const map = minPricesByBlueprintFromMarketplace({
      "10": [{ price: { cents: 50, currency: "USD" } }],
      "20": [
        { price: { cents: 120, currency: "USD" } },
        { price: { cents: 200, currency: "USD" } },
      ],
    });
    expect(map.get(10)).toMatchObject({ cents: 50, currency: "USD" });
    expect(map.get(20)).toMatchObject({ cents: 120, currency: "USD" });
  });

  it("ignora price_cents/price_currency (moneda del vendedor) y solo usa price", () => {
    // Simula producto donde solo existe price_cents en BRL pero no price.cents
    const map = minPricesByBlueprintFromMarketplace({
      "30": [{ price_cents: 999, price_currency: "BRL" }],
    });
    // Sin price.cents válido, no hay precio disponible → no se agrega al mapa
    expect(map.has(30)).toBe(false);
  });

  it("usa price.currency incluso si price_currency es diferente", () => {
    // CardTrader devuelve price en moneda del comprador y price_currency del vendedor
    const map = minPricesByBlueprintFromMarketplace({
      "10": [
        { price: { cents: 40, currency: "USD" }, price_cents: 36, price_currency: "EUR" },
      ],
    });
    expect(map.get(10)).toMatchObject({ cents: 40, currency: "USD" });
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
  it("usa código ISO en lugar del campo formatted de CardTrader", () => {
    expect(
      formatBlueprintMarketPrice({ cents: 40, currency: "USD", formatted: "$0.40" }),
    ).toBe("0.40 USD");
  });
  it("muestra código ZAR en lugar del símbolo R", () => {
    expect(
      formatBlueprintMarketPrice({ cents: 150, currency: "ZAR", formatted: "R 1.50" }),
    ).toBe("1.50 ZAR");
  });
  it("formatea sin campo formatted", () => {
    expect(formatBlueprintMarketPrice({ cents: 99, currency: "EUR" })).toBe("0.99 EUR");
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
