import { describe, expect, it } from "vitest";
import {
  buildEstebanStockPdfFilename,
  buildSentUnitsPdfFilename,
  groupSentUnitsByBlueprint,
  totalUnitsFromRows,
} from "./export-sent-units-pdf";

describe("groupSentUnitsByBlueprint", () => {
  it("agrupa unidades del mismo blueprint sumando cantidades", () => {
    const rows = groupSentUnitsByBlueprint([
      { name: "Pikachu", language: "EN", rareza: "foil", blueprint_id: 42 },
      { name: "Pikachu", language: "EN", rareza: "foil", blueprint_id: 42 },
      { name: "Raichu", language: "EN", rareza: null, blueprint_id: 99, qty: 3 },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.name === "Pikachu")?.units).toBe(2);
    expect(rows.find((r) => r.name === "Raichu")?.units).toBe(3);
  });

  it("columnas visibles solo son nombre, idioma, rareza y unidades", () => {
    const rows = groupSentUnitsByBlueprint([
      { name: "Mew", language: "JP", rareza: "masterball", blueprint_id: 7 },
    ]);
    expect(rows[0].name).toBe("Mew");
    expect(rows[0].language).toBe("JP");
    expect(rows[0].rareza).toBe("Masterball");
    expect(rows[0].units).toBe(1);
  });

  it("conserva imageUrl del grupo para el PDF", () => {
    const rows = groupSentUnitsByBlueprint([
      {
        name: "Pikachu",
        language: "EN",
        blueprint_id: 1,
        imageUrl: "https://example.com/pika.jpg",
      },
      { name: "Pikachu", language: "EN", blueprint_id: 1 },
    ]);
    expect(rows[0].imageUrl).toBe("https://example.com/pika.jpg");
  });

  it("si un blueprint tiene idiomas distintos, los une", () => {
    const rows = groupSentUnitsByBlueprint([
      { name: "Eevee", language: "EN", rareza: "foil", blueprint_id: 10 },
      { name: "Eevee", language: "JP", rareza: "foil", blueprint_id: 10 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].units).toBe(2);
    expect(rows[0].language).toBe("EN, JP");
  });

  it("sin blueprint agrupa por nombre+idioma+rareza", () => {
    const rows = groupSentUnitsByBlueprint([
      { name: "Unknown", language: "EN", rareza: null, blueprint_id: null },
      { name: "Unknown", language: "EN", rareza: null },
      { name: "Unknown", language: "JP", rareza: null },
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe("buildSentUnitsPdfFilename", () => {
  it("usa fecha fija", () => {
    expect(buildSentUnitsPdfFilename(new Date("2026-07-15T12:00:00Z"))).toBe(
      "cartas-en-envio-20260715.pdf",
    );
  });
});

describe("buildEstebanStockPdfFilename", () => {
  it("usa prefijo cartas-esteban", () => {
    expect(buildEstebanStockPdfFilename(new Date("2026-08-24T12:00:00Z"))).toBe(
      "cartas-esteban-20260824.pdf",
    );
  });
});

describe("totalUnitsFromRows", () => {
  it("suma unidades", () => {
    expect(
      totalUnitsFromRows([
        { name: "A", language: "EN", rareza: "—", units: 2 },
        { name: "B", language: "EN", rareza: "—", units: 3 },
      ]),
    ).toBe(5);
  });
});
