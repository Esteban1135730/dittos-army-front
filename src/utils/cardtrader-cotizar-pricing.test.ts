import { describe, expect, it } from "vitest";
import {
  allocateCartFeePerUnitCop,
  computeCardtraderUnitCostCop,
} from "./cardtrader-cotizar-pricing";

describe("computeCardtraderUnitCostCop", () => {
  it("sin fee del carrito estima 5% + 900 COP envío y PVP +30%", () => {
    const purchaseCop = 4000;
    const b = computeCardtraderUnitCostCop(purchaseCop);
    expect(b.purchaseCop).toBe(4000);
    expect(b.feeCop).toBeCloseTo(200, 5);
    expect(b.shippingCop).toBe(900);
    expect(b.feePlusShippingCop).toBeCloseTo(1100, 5);
    expect(b.realCostCop).toBeCloseTo(5100, 5);
    expect(b.pvpApproxCop).toBeCloseTo(5100 * 1.3, 5);
  });

  it("con fee del carrito usa ese monto por unidad (no el 5%)", () => {
    const b = computeCardtraderUnitCostCop(4000, 150);
    expect(b.feeCop).toBe(150);
    expect(b.realCostCop).toBe(4000 + 150 + 900);
    expect(b.pvpApproxCop).toBeCloseTo((4000 + 150 + 900) * 1.3, 5);
  });
});

describe("allocateCartFeePerUnitCop", () => {
  it("reparte el fee del carrito de modo que la suma de líneas coincida", () => {
    const lines = [
      { purchaseCop: 4000, qty: 2 },
      { purchaseCop: 2000, qty: 1 },
    ];
    const totalFee = 300;
    const perUnit = allocateCartFeePerUnitCop(lines, totalFee);
    const sum = perUnit[0] * 2 + perUnit[1] * 1;
    expect(sum).toBeCloseTo(totalFee, 8);
    // 8000 / 10000 = 0.8 → 240 en la primera línea → 120 / u
    expect(perUnit[0]).toBeCloseTo(120, 8);
    expect(perUnit[1]).toBeCloseTo(60, 8);
  });

  it("si no hay base COP, reparte por cantidad", () => {
    const perUnit = allocateCartFeePerUnitCop(
      [
        { purchaseCop: 0, qty: 1 },
        { purchaseCop: 0, qty: 3 },
      ],
      100,
    );
    expect(perUnit[0] * 1 + perUnit[1] * 3).toBeCloseTo(100, 8);
  });
});
