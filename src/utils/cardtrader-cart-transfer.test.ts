import { describe, expect, it } from "vitest";
import {
  buildCartExportPayload,
  extractCartItemsFromResponse,
  formatCartImportSnack,
  importCartExportBestEffort,
  parseCartExportJsonText,
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

  it("parseCartExportJsonText parsea texto JSON", () => {
    const parsed = parseCartExportJsonText(
      JSON.stringify({
        version: 1,
        sourceOwner: "esteban",
        exportedAt: "2026-08-31T12:00:00.000Z",
        items: [{ product_id: 7, quantity: 2 }],
      }),
    );
    expect(parsed.items[0]?.product_id).toBe(7);
  });

  it("parseCartExportJsonText rechaza texto vacío o no JSON", () => {
    expect(() => parseCartExportJsonText("  ")).toThrow(/pega o carga/i);
    expect(() => parseCartExportJsonText("{no-json")).toThrow(/no es un JSON/i);
  });

  it("importCartExportBestEffort añade lo posible y reporta fallos", async () => {
    const added: number[] = [];
    const result = await importCartExportBestEffort({
      items: [
        { product_id: 1, quantity: 1, name: "A" },
        { product_id: 2, quantity: 1, name: "B" },
        { product_id: 3, quantity: 1, name: "C" },
      ],
      addItem: async (item) => {
        if (item.product_id === 2) {
          throw new Error("agotado");
        }
        added.push(item.product_id);
      },
    });
    expect(added).toEqual([1, 3]);
    expect(result).toEqual({
      imported: 2,
      total: 3,
      failed: [{ product_id: 2, name: "B", error: "agotado" }],
    });
    expect(formatCartImportSnack(result).severity).toBe("warning");
  });
});
