import { describe, expect, it } from "vitest";
import { filterSalesByName } from "./filter-sales-by-name";

const sales = [
  { _id: "1", stock_info: { card_name: "Charizard ex" } },
  { _id: "2", stock_info: { card_name: "Pikachu" } },
  { _id: "3", stock_info: { card_name: "Dark Charizard" } },
  { _id: "4", stock_info: undefined },
];

describe("filterSalesByName", () => {
  it("devuelve todas las ventas si la búsqueda está vacía o solo espacios", () => {
    expect(filterSalesByName(sales, "")).toEqual(sales);
    expect(filterSalesByName(sales, "   ")).toEqual(sales);
  });

  it("filtra por nombre sin distinguir mayúsculas", () => {
    expect(filterSalesByName(sales, "charizard").map((s) => s._id)).toEqual([
      "1",
      "3",
    ]);
    expect(filterSalesByName(sales, "PIKA").map((s) => s._id)).toEqual(["2"]);
  });

  it("omite ventas sin nombre cuando hay término", () => {
    expect(filterSalesByName(sales, "xyz")).toEqual([]);
  });
});
