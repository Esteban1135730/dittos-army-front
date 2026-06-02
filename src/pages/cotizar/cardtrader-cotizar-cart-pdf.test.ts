import { describe, expect, it } from "vitest";
import {
  buildCardtraderCartDetailText,
  buildCardtraderCartPdfFilename,
  compareCotizarCartPdfLines,
  totalPvpCopFromLines,
  type CotizarCartPdfLine,
} from "./cardtrader-cotizar-cart-pdf";

describe("buildCardtraderCartDetailText", () => {
  it("incluye metadatos en líneas separadas", () => {
    const text = buildCardtraderCartDetailText("Pikachu", {
      expansion: "Base Set",
      collectorNumber: "58",
      rarity: "Rare Holo",
      condition: "NM",
      language: "EN",
    });
    expect(text).toContain("Pikachu");
    expect(text).toContain("Base Set");
    expect(text).toContain("#58");
    expect(text).toContain("Rare Holo");
    expect(text).toContain("NM");
    expect(text).toContain("EN");
  });

  it("devuelve solo el nombre si no hay meta", () => {
    expect(buildCardtraderCartDetailText("Mewtwo")).toBe("Mewtwo");
  });
});

describe("compareCotizarCartPdfLines", () => {
  it("ordena por nombre y luego por PVP unitario", () => {
    const a: CotizarCartPdfLine = {
      productId: 1,
      name: "Bulbasaur",
      qty: 1,
      pvpUnitCop: 10_000,
      pvpLineCop: 10_000,
    };
    const b: CotizarCartPdfLine = {
      productId: 2,
      name: "Abra",
      qty: 2,
      pvpUnitCop: 5_000,
      pvpLineCop: 10_000,
    };
    expect(compareCotizarCartPdfLines(a, b)).toBeGreaterThan(0);
  });
});

describe("totalPvpCopFromLines", () => {
  it("suma PVP por línea", () => {
    const total = totalPvpCopFromLines([
      { productId: 1, name: "A", qty: 2, pvpUnitCop: 1_000, pvpLineCop: 2_000 },
      { productId: 2, name: "B", qty: 1, pvpUnitCop: 500, pvpLineCop: 500 },
    ]);
    expect(total).toBe(2_500);
  });
});

describe("buildCardtraderCartPdfFilename", () => {
  it("usa prefijo cotizacion y fecha", () => {
    expect(buildCardtraderCartPdfFilename(new Date("2026-05-26T12:00:00"))).toBe(
      "cotizacion-20260526.pdf",
    );
  });
});
