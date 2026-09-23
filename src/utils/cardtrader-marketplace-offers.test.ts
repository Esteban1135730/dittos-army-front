import { describe, expect, it } from "vitest";
import {
  expansionIdFromProducts,
  matchesOfferFilters,
  productUsd,
} from "./cardtrader-marketplace-offers";

describe("cardtrader-marketplace-offers", () => {
  const product = {
    id: 1,
    price: { cents: 500 },
    properties_hash: {
      condition: "Near Mint",
      pokemon_language: "en",
    },
    expansion: { id: 42 },
  };

  it("productUsd convierte centavos", () => {
    expect(productUsd(product)).toBe(5);
  });

  it("expansionIdFromProducts toma el primero válido", () => {
    expect(expansionIdFromProducts([product])).toBe(42);
    expect(expansionIdFromProducts([{ id: 2 }])).toBeNull();
  });

  it("matchesOfferFilters por estado e idioma", () => {
    expect(matchesOfferFilters(product, ["Near Mint"], [], null, null)).toBe(true);
    expect(matchesOfferFilters(product, ["Played"], [], null, null)).toBe(false);
    expect(matchesOfferFilters(product, [], ["en"], null, null)).toBe(true);
    expect(matchesOfferFilters(product, [], ["es"], null, null)).toBe(false);
  });

  it("lee yugioh_language en filtros de idioma", () => {
    const ygo = {
      id: 2,
      price: { cents: 100 },
      properties_hash: {
        condition: "Near Mint",
        yugioh_language: "es",
      },
    };
    expect(matchesOfferFilters(ygo, [], ["es"], null, null)).toBe(true);
    expect(matchesOfferFilters(ygo, [], ["en"], null, null)).toBe(false);
  });

  it("matchesOfferFilters por rango USD", () => {
    expect(matchesOfferFilters(product, [], [], 6, 4)).toBe(true);
    expect(matchesOfferFilters(product, [], [], 4, null)).toBe(false);
    expect(matchesOfferFilters(product, [], [], 10, null)).toBe(true);
    expect(matchesOfferFilters(product, [], [], null, 6)).toBe(false);
  });
});
