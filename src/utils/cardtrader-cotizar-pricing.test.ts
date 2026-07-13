import { describe, expect, it } from "vitest";
import { computeCardtraderUnitCostCop } from "./cardtrader-cotizar-pricing";

describe("computeCardtraderUnitCostCop", () => {
  it("calcula precio solo con envío: carta + 700 COP + 5% comisión", () => {
    const purchaseCop = 4000;
    const b = computeCardtraderUnitCostCop(purchaseCop);
    expect(b.priceShippingOnlyCop).toBe(4000 * 1.05 + 700);
  });

  it("aplica envío 900 COP, IVA 19% y PVP +30%", () => {
    const purchaseCop = 4000;
    const b = computeCardtraderUnitCostCop(purchaseCop);
    expect(b.subtotalBeforeIva).toBe(4900);
    expect(b.ivaCop).toBeCloseTo(931, 5);
    expect(b.ivaPlusShippingCop).toBeCloseTo(900 + 931, 5);
    expect(b.realCostCop).toBeCloseTo(5831, 5);
    expect(b.pvpApproxCop).toBeCloseTo(5831 * 1.3, 5);
  });
});
