import { describe, expect, it } from "vitest";
import {
  allocatePedidoAddedFromCart,
  blueprintQtyInCart,
  syncPedidoProgressFromCart,
} from "./cardtrader-pedido-cart-sync";
import type { ParsedPedidoLine } from "./parse-cardtrader-pedido";

const line = (id: string, blueprintId: number, quantity: number): ParsedPedidoLine => ({
  id,
  lineNumber: 1,
  quantity,
  blueprintId,
  slug: "x",
  displayName: "X",
  url: "https://example.com",
  clientNotes: "",
  maxUsdHint: null,
});

describe("cardtrader-pedido-cart-sync", () => {
  const cart = {
    subcarts: [
      {
        cart_items: [
          {
            quantity: 2,
            product: {
              id: 9001,
              marketplace_meta: { blueprint_id: 100 },
            },
          },
          {
            quantity: 1,
            product: { id: 9002, blueprint_id: 200 },
          },
        ],
      },
    ],
  };

  it("blueprintQtyInCart suma por blueprint", () => {
    const map = blueprintQtyInCart(cart, {});
    expect(map.get(100)).toBe(2);
    expect(map.get(200)).toBe(1);
  });

  it("usa meta local si el carrito no trae blueprint_id", () => {
    const cartNoBp = {
      subcarts: [{ cart_items: [{ quantity: 3, product: { id: 55 } }] }],
    };
    const map = blueprintQtyInCart(cartNoBp, { 55: { blueprintId: 777 } });
    expect(map.get(777)).toBe(3);
  });

  it("allocatePedidoAddedFromCart reparte en orden", () => {
    const lines = [line("a", 100, 2), line("b", 100, 2)];
    const map = new Map([[100, 3]]);
    expect(allocatePedidoAddedFromCart(lines, map)).toEqual({ a: 2, b: 1 });
  });

  it("syncPedidoProgressFromCart marca in_cart al completar", () => {
    const lines = [line("a", 100, 2)];
    const result = syncPedidoProgressFromCart(lines, cart, {}, {});
    expect(result.addedQtyByLineId.a).toBe(2);
    expect(result.statusByLineId.a).toBe("in_cart");
  });

  it("sync respeta líneas omitidas y hechas", () => {
    const lines = [line("a", 100, 2), line("b", 200, 1)];
    const result = syncPedidoProgressFromCart(lines, cart, {}, {
      a: "skipped",
      b: "done",
    });
    expect(result.addedQtyByLineId.a).toBeUndefined();
    expect(result.addedQtyByLineId.b).toBe(1);
    expect(result.statusByLineId.b).toBe("done");
  });
});
