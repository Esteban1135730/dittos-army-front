import { describe, expect, it } from "vitest";
import {
  buildCartExportPayload,
  extractCartItemsFromResponse,
  parseCartExportPayload,
} from "./cardtrader-cart-transfer";

describe("cardtrader-cart-transfer", () => {
  it("extractCartItemsFromResponse agrupa líneas por product_id", () => {
    const items = extractCartItemsFromResponse({
      subcarts: [
        {
          cart_items: [
            { quantity: 2, product: { id: 10, name_en: "Pikachu" } },
            { quantity: 1, product: { id: 20 } },
          ],
        },
      ],
    });
    expect(items).toEqual([
      { product_id: 10, quantity: 2, name: "Pikachu" },
      { product_id: 20, quantity: 1, name: undefined },
    ]);
  });

  it("buildCartExportPayload incluye meta y owner", () => {
    const payload = buildCartExportPayload({
      sourceOwner: "esteban",
      exportedAt: "2026-08-31T12:00:00.000Z",
      cart: {
        subcarts: [{ cart_items: [{ quantity: 1, product: { id: 5, name_en: "Mew" } }] }],
      },
      metaByProductId: { 5: { pvpPropioCop: 12000 } },
    });
    expect(payload.sourceOwner).toBe("esteban");
    expect(payload.items[0]?.meta?.pvpPropioCop).toBe(12000);
  });

  it("parseCartExportPayload valida líneas", () => {
    const parsed = parseCartExportPayload({
      version: 1,
      sourceOwner: "esteban",
      exportedAt: "2026-08-31T12:00:00.000Z",
      items: [{ product_id: 99, quantity: 3, name: "Charizard" }],
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.product_id).toBe(99);
  });

  it("parseCartExportPayload rechaza payload vacío", () => {
    expect(() =>
      parseCartExportPayload({
        version: 1,
        sourceOwner: "esteban",
        exportedAt: "2026-08-31T12:00:00.000Z",
        items: [],
      }),
    ).toThrow(/no tiene líneas/i);
  });
});
