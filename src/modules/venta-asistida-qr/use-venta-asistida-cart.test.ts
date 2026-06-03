import { describe, expect, it } from "vitest";
import {
  addCartLine,
  cartTotalCop,
  cartTotalProfitCop,
  lineProfitCop,
  updateCartLinePrice,
} from "./cart-helpers";

const line = {
  stock_id: "507f1f77bcf86cd799439011",
  card_id: "swsh3-136",
  card_name: "Pikachu",
  image_url: "",
  amount_cop: 50000,
  card_cost_cop: 30000,
  expansion: "Base Set",
  rareza: null,
  language: "EN",
};

describe("cart-helpers", () => {
  it("añade línea y calcula total y ganancia", () => {
    const { lines, status } = addCartLine([], line);
    expect(status).toBe("ok");
    expect(cartTotalCop(lines)).toBe(50000);
    expect(lineProfitCop(lines[0])).toBe(20000);
    expect(cartTotalProfitCop(lines)).toBe(20000);
  });

  it("rechaza duplicado", () => {
    const first = addCartLine([], line);
    const second = addCartLine(first.lines, line);
    expect(second.status).toBe("duplicate");
  });

  it("actualiza precio y recalcula ganancia", () => {
    const { lines } = addCartLine([], line);
    const updated = updateCartLinePrice(lines, line.stock_id, 60000);
    expect(cartTotalProfitCop(updated)).toBe(30000);
  });
});
