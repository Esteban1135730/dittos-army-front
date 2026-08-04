import { describe, expect, it } from "vitest";
import {
  addCartLine,
  cartTotalCop,
  cartTotalProfitCop,
  expandCartLinesToSellBatchItems,
  lineProfitCop,
  updateCartLinePrice,
  updateCartLineQty,
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
  owner: "pablo" as const,
};

const bulkLine = {
  stock_id: "507f1f77bcf86cd799439099",
  card_id: "da-bulk",
  card_name: "bulk",
  image_url: "/bulk-dummy.svg",
  amount_cop: 2000,
  card_cost_cop: 0,
  expansion: "",
  rareza: null,
  language: "",
  product_kind: "quantity" as const,
  qty: 1,
  owner: "pablo" as const,
};

describe("cart-helpers", () => {
  it("añade línea y calcula total y ganancia", () => {
    const { lines, status } = addCartLine([], line);
    expect(status).toBe("ok");
    expect(cartTotalCop(lines)).toBe(50000);
    expect(lineProfitCop(lines[0])).toBe(20000);
    expect(cartTotalProfitCop(lines)).toBe(20000);
  });

  it("rechaza duplicado unitario", () => {
    const first = addCartLine([], line);
    const second = addCartLine(first.lines, line);
    expect(second.status).toBe("duplicate");
  });

  it("incrementa qty en producto quantity", () => {
    const first = addCartLine([], bulkLine);
    expect(first.status).toBe("ok");
    const second = addCartLine(first.lines, bulkLine);
    expect(second.status).toBe("incremented");
    expect(second.lines[0].qty).toBe(2);
    expect(cartTotalCop(second.lines)).toBe(4000);
  });

  it("expande quantity a N ítems sell-batch", () => {
    const { lines } = addCartLine([], { ...bulkLine, qty: 3 });
    const items = expandCartLinesToSellBatchItems(lines);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.stock_id === bulkLine.stock_id)).toBe(true);
  });

  it("actualiza precio y recalcula ganancia", () => {
    const { lines } = addCartLine([], line);
    const updated = updateCartLinePrice(lines, line.stock_id, 60000);
    expect(cartTotalProfitCop(updated)).toBe(30000);
  });

  it("actualiza qty de quantity product", () => {
    const { lines } = addCartLine([], bulkLine);
    const updated = updateCartLineQty(lines, bulkLine.stock_id, 5);
    expect(updated[0].qty).toBe(5);
    expect(cartTotalCop(updated)).toBe(10000);
  });

  it("conserva la marca reserved de una línea reservada", () => {
    const { lines, status } = addCartLine([], { ...line, reserved: true });
    expect(status).toBe("ok");
    expect(lines[0].reserved).toBe(true);
    expect(cartTotalCop(lines)).toBe(50000);
  });
});
