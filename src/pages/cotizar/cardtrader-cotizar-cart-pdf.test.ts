import { describe, expect, it } from "vitest";
import {
  buildCardtraderCartDetailText,
  buildCardtraderCartPdfFilename,
  buildCotizarCartPdfTableRows,
  compareCotizarCartPdfLines,
  COTIZAR_CART_PDF_NO_EXPANSION,
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

  it("añade variantes sin sustituir la rareza de blueprint", () => {
    const text = buildCardtraderCartDetailText("Charizard", {
      rarity: "Rare",
      variants: ["Pokeball", "First edition"],
      condition: "NM",
    });
    expect(text).toContain("Rare");
    expect(text).toContain("Pokeball");
    expect(text).toContain("First edition");
    expect(text).toContain("NM");
  });

  it("devuelve solo el nombre si no hay meta", () => {
    expect(buildCardtraderCartDetailText("Mewtwo")).toBe("Mewtwo");
  });
});

function line(
  partial: Pick<CotizarCartPdfLine, "productId" | "name"> &
    Partial<Omit<CotizarCartPdfLine, "productId" | "name">>,
): CotizarCartPdfLine {
  return {
    qty: 1,
    pvpUnitCop: 1_000,
    pvpLineCop: 1_000,
    ...partial,
  };
}

describe("buildCotizarCartPdfTableRows", () => {
  it("agrupa por expansión y ordena cada set por nombre de carta", () => {
    const rows = buildCotizarCartPdfTableRows([
      line({
        productId: 1,
        name: "Pikachu",
        meta: { expansion: "Prismatic Evolutions", collectorNumber: "25" },
      }),
      line({
        productId: 2,
        name: "Charizard",
        meta: { expansion: "Base Set", rarity: "Rare Holo" },
      }),
      line({
        productId: 3,
        name: "Eevee",
        meta: { expansion: "Prismatic Evolutions", variants: ["Reverse"] },
      }),
      line({ productId: 4, name: "Mew" }),
    ]);

    expect(rows.map((row) => (row.kind === "group" ? row.label : row.line.name))).toEqual([
      "Base Set · 1 carta",
      "Charizard",
      "Prismatic Evolutions · 2 cartas",
      "Eevee",
      "Pikachu",
      `${COTIZAR_CART_PDF_NO_EXPANSION} · 1 carta`,
      "Mew",
    ]);

    const charizard = rows.find((row) => row.kind === "line" && row.line.name === "Charizard");
    expect(charizard?.kind === "line" && charizard.detail).toContain("Rare Holo");
    expect(charizard?.kind === "line" && charizard.detail).not.toContain("Base Set");

    const eevee = rows.find((row) => row.kind === "line" && row.line.name === "Eevee");
    expect(eevee?.kind === "line" && eevee.detail).toContain("Reverse");
  });

  it("dentro de la misma expansión ordena por número de coleccionista", () => {
    const rows = buildCotizarCartPdfTableRows([
      line({
        productId: 1,
        name: "Pikachu",
        meta: { expansion: "Base Set", collectorNumber: "58" },
      }),
      line({
        productId: 2,
        name: "Pikachu",
        meta: { expansion: "Base Set", collectorNumber: "4" },
      }),
    ]);

    const names = rows.flatMap((row) =>
      row.kind === "line" ? [row.line.meta?.collectorNumber] : [],
    );
    expect(names).toEqual(["4", "58"]);
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

  it("acepta sufijo opcional", () => {
    expect(
      buildCardtraderCartPdfFilename(new Date("2026-05-26T12:00:00"), "pvp-propio"),
    ).toBe("cotizacion-pvp-propio-20260526.pdf");
  });
});
