import { describe, expect, it } from "vitest";
import { benchmarkRowToStockItem } from "./benchmark-row-to-stock-item";
import type { StockPvpBenchmarkRow } from "./stock-pvp-benchmark.types";

const baseRow: StockPvpBenchmarkRow = {
  variant_key: "sv1-1|en|holo",
  card_id: "sv1-1",
  card_name: "Test",
  language: "en",
  rareza: "holo",
  image_url: "",
  qty_stock: 2,
  card_cost_avg: 1000,
  pvp_current: 5000,
  pvp_pablo: null,
  pvp_esteban: null,
  sales_count: 0,
  sale_min_cop: null,
  sale_max_cop: null,
  sale_min_owner: null,
  sale_max_owner: null,
  sale_last_cop: null,
  sale_last_at: null,
  hint: "no_sales",
};

describe("benchmarkRowToStockItem", () => {
  it("mapea PVP y rareza para PvpInlineCell", () => {
    const item = benchmarkRowToStockItem(baseRow);
    expect(item._id).toBe(baseRow.variant_key);
    expect(item.card_id).toBe("sv1-1");
    expect(item.pvp).toBe(5000);
    expect(item.pvp_currency).toBe("COP");
    expect(item.rareza).toBe("holo");
  });
});
