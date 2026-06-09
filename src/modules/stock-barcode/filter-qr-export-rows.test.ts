import { describe, expect, it } from "vitest";
import { filterQrExportRowsByStockIds } from "./filter-qr-export-rows";
import type { StockQrExportRow } from "./types";

const row = (id: string): StockQrExportRow => ({
  stock_id: id,
  qr_value: `DA-STOCK:${id}`,
  card_name: "Test",
  expansion: "Set",
  rareza: null,
  language: "EN",
  price_cop: 1000,
});

describe("filterQrExportRowsByStockIds", () => {
  it("filtra por ids visibles", () => {
    const rows = [row("a"), row("b"), row("c")];
    expect(filterQrExportRowsByStockIds(rows, ["a", "c"]).map((r) => r.stock_id)).toEqual([
      "a",
      "c",
    ]);
  });
});
