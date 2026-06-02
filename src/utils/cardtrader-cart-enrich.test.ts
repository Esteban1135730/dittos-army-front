import { describe, expect, it } from "vitest";
import { cartProductIdsForBlueprint } from "./cardtrader-cart-enrich";

describe("cartProductIdsForBlueprint", () => {
  const cart = {
    subcarts: [
      {
        cart_items: [
          {
            quantity: 1,
            product: { id: 10, marketplace_meta: { blueprint_id: 100 } },
          },
          {
            quantity: 2,
            product: { id: 20, marketplace_meta: { blueprint_id: 200 } },
          },
        ],
      },
    ],
  };

  it("devuelve productos del blueprint", () => {
    expect(cartProductIdsForBlueprint(cart, 100)).toEqual([10]);
    expect(cartProductIdsForBlueprint(cart, 200)).toEqual([20]);
    expect(cartProductIdsForBlueprint(cart, 999)).toEqual([]);
  });

  it("usa meta local si el carrito no trae blueprint", () => {
    const cartNoBp = {
      subcarts: [{ cart_items: [{ quantity: 1, product: { id: 55 } }] }],
    };
    expect(cartProductIdsForBlueprint(cartNoBp, 777, { 55: { blueprintId: 777 } })).toEqual([55]);
  });
});
