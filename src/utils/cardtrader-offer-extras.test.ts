import { describe, expect, it } from "vitest";
import {
  availableOfferExtraFacets,
  matchesOfferExtrasFilter,
  productOfferExtraFacetIds,
  productOfferExtraLabels,
} from "./cardtrader-offer-extras";
import type { CtMarketplaceProduct } from "./cardtrader-marketplace-offers";

const product = (hash: Record<string, unknown>): CtMarketplaceProduct => ({
  id: 1,
  properties_hash: hash,
});

describe("cardtrader-offer-extras", () => {
  it("detecta first edition y reverse", () => {
    const p = product({ first_edition: true, reverse: "true", condition: "Near Mint" });
    expect(productOfferExtraFacetIds(p)).toContain("first_edition");
    expect(productOfferExtraFacetIds(p)).toContain("reverse");
    expect(productOfferExtraLabels(p)).toEqual(
      expect.arrayContaining(["First Edition", "Reverse Holo"]),
    );
  });

  it("filtra por extras seleccionados (OR)", () => {
    const p = product({ first_edition: true });
    expect(matchesOfferExtrasFilter(p, ["first_edition"])).toBe(true);
    expect(matchesOfferExtrasFilter(p, ["reverse"])).toBe(false);
    expect(matchesOfferExtrasFilter(p, [])).toBe(true);
  });

  it("lista facetas disponibles en el lote", () => {
    const facets = availableOfferExtraFacets([
      product({ first_edition: true }),
      product({ mtg_foil: true }),
    ]);
    expect(facets.map((f) => f.id)).toEqual(expect.arrayContaining(["first_edition", "foil"]));
  });

  it("no trata yugioh_language como extra", () => {
    const p = product({
      condition: "Near Mint",
      yugioh_language: "en",
      first_edition: true,
    });
    expect(productOfferExtraFacetIds(p)).toEqual(["first_edition"]);
    expect(productOfferExtraLabels(p)).toEqual(["First Edition"]);
  });
});
