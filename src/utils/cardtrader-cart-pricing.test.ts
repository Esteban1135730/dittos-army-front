import { describe, expect, it } from "vitest";
import { resolveCartItemPricing } from "./cardtrader-cart-pricing";

describe("resolveCartItemPricing", () => {
  it("paquete ×6: 37.20 USD total → 6.20 USD/u (ignora marketplace unitario)", () => {
    const r = resolveCartItemPricing({
      priceCents: 3720,
      quantity: 6,
      subcartItems: [{ priceCents: 3720, quantity: 6 }],
      marketplaceUnitPriceCents: 620,
    });
    expect(r.lineTotalCents).toBe(3720);
    expect(r.unitCents).toBe(620);
    expect(r.priceWasLineTotal).toBe(true);
  });

  it("subtotal = total paquete → unitario = total / qty", () => {
    const r = resolveCartItemPricing({
      priceCents: 3720,
      quantity: 6,
      subcartItems: [{ priceCents: 3720, quantity: 6 }],
      subcartSubtotalCents: 3720,
    });
    expect(r.unitCents).toBe(620);
    expect(r.lineTotalCents).toBe(3720);
  });

  it("subtotal = qty × precio unitario en API → mantiene unitario", () => {
    const r = resolveCartItemPricing({
      priceCents: 620,
      quantity: 6,
      subcartItems: [{ priceCents: 620, quantity: 6 }],
      subcartSubtotalCents: 3720,
    });
    expect(r.unitCents).toBe(620);
    expect(r.lineTotalCents).toBe(3720);
    expect(r.priceWasLineTotal).toBe(false);
  });
});
