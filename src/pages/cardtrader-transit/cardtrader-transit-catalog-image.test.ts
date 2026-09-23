import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/api", () => ({
  apiBase: () => "https://api.test/pokemon",
  apiUrl: (path: string) => {
    if (path.startsWith("/card-images")) return `https://api.test${path}`;
    return `https://api.test/pokemon${path}`;
  },
  getApiOrigin: () => "https://api.test",
}));

vi.mock("../../constants/bulk-product", async () => {
  const { rewriteCardImagesUrl } = await import("../../utils/card-images-url");
  return {
    resolveStockImageUrl: (cardId: string | null | undefined, imageUrl: string | null | undefined) => {
      const url = String(imageUrl ?? "").trim();
      if (!url) return "";
      return rewriteCardImagesUrl(url, (path: string) => `https://api.test${path}`);
    },
    reservaCatalogPinRank: () => 99,
  };
});

import { resolveTransitCatalogImageSrc } from "./cardtrader-transit-catalog-image";

describe("resolveTransitCatalogImageSrc", () => {
  it("prioriza imagen TCGdex sobre URL vacía o caché local", () => {
    const details = {
      "sv01-001": { imageUrl: "https://assets.tcgdex.net/en/sv01/001/low.webp" },
    };
    expect(resolveTransitCatalogImageSrc("sv01-001", "", details, "en")).toBe(
      "https://assets.tcgdex.net/en/sv01/001/low.webp",
    );
    expect(
      resolveTransitCatalogImageSrc("sv01-001", "/card-images/sv01/sv01-001.png", details, "en"),
    ).toBe("https://assets.tcgdex.net/en/sv01/001/low.webp");
  });

  it("usa proxy Nest para URLs CardTrader si no hay TCGdex", () => {
    expect(
      resolveTransitCatalogImageSrc(
        "unknown-id",
        "https://www.cardtrader.com/uploads/x.jpg",
        {},
        "en",
      ),
    ).toContain("/cardtrader/images/proxy?url=");
  });

  it("reescribe /card-images si no hay TCGdex", () => {
    expect(
      resolveTransitCatalogImageSrc("sv8-194", "/card-images/sv8/sv8-194.png", {}, "en"),
    ).toBe("https://api.test/card-images/sv8/sv8-194.png");
  });
});
