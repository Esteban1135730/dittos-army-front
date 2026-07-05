import { describe, expect, it } from "vitest";
import {
  filterStockVisibleInGrid,
  isStockLineVisibleInGrid,
} from "./stock-grid-visible";

describe("stock-grid-visible", () => {
  it("oculta vendida y propiedad", () => {
    expect(isStockLineVisibleInGrid({ card_state: "disponible" })).toBe(true);
    expect(isStockLineVisibleInGrid({ card_state: "vendida" })).toBe(false);
    expect(isStockLineVisibleInGrid({ card_state: "propiedad" })).toBe(false);
  });

  it("filtra listas como la grilla Stock", () => {
    const items = [
      { card_state: "disponible", _id: "1" },
      { card_state: "vendida", _id: "2" },
      { card_state: "en_stock_colombia", _id: "3" },
    ];
    expect(filterStockVisibleInGrid(items).map((i) => i._id)).toEqual([
      "1",
      "3",
    ]);
  });
});
