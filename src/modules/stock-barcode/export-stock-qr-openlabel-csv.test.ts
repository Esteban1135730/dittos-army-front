import { describe, expect, it } from "vitest";
import {
  OPENLABEL_CSV_COLUMNS,
  buildOpenLabelQrLabelsCsv,
} from "./export-stock-qr-openlabel-csv";
import type { StockQrExportRow } from "./types";

const sample = (partial?: Partial<StockQrExportRow>): StockQrExportRow => ({
  stock_id: "abc123",
  qr_value: "DA-STOCK:abc123",
  card_name: "Pikachu",
  expansion: "SV01",
  rareza: "rare",
  language: "EN",
  price_cop: 15000,
  ...partial,
});

describe("buildOpenLabelQrLabelsCsv", () => {
  it("incluye BOM UTF-8 y cabeceras OpenLabel+", () => {
    const csv = buildOpenLabelQrLabelsCsv([sample()]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(OPENLABEL_CSV_COLUMNS.join(","));
  });

  it("emite una fila de datos por etiqueta", () => {
    const csv = buildOpenLabelQrLabelsCsv([
      sample(),
      sample({ stock_id: "xyz", qr_value: "DA-STOCK:xyz", card_name: "Mew" }),
    ]);
    const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r\n/);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("DA-STOCK:abc123");
    expect(lines[2]).toContain("Mew");
  });

  it("escapa comillas y comas en celdas", () => {
    const csv = buildOpenLabelQrLabelsCsv([
      sample({ card_name: 'Charizard, "EX"' }),
    ]);
    expect(csv).toContain('"Charizard, ""EX"""');
  });

  it("rareza null → celda vacía", () => {
    const csv = buildOpenLabelQrLabelsCsv([sample({ rareza: null })]);
    const dataLine = csv.replace(/^\uFEFF/, "").trim().split(/\r\n/)[1];
    const cells = dataLine.split(",");
    const rarezaIdx = OPENLABEL_CSV_COLUMNS.indexOf("rareza");
    expect(cells[rarezaIdx]).toBe("");
  });

  it("falla si no hay filas", () => {
    expect(() => buildOpenLabelQrLabelsCsv([])).toThrow(/OpenLabel/);
  });
});
