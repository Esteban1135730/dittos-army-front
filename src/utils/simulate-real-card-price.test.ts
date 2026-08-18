import { describe, expect, it } from "vitest";
import {
  computeSimulatedRealPriceCop,
  IVA_RATE,
  parseNonNegativeNumberLoose,
  parsePositiveIntLoose,
  parsePositiveNumberLoose,
  resolveUsdCopRate,
  simulationNeedsWarning,
} from "./simulate-real-card-price";

describe("computeSimulatedRealPriceCop", () => {
  it("ejemplo real: 938 cartas, 738 USD, envío COP — IVA = 19% sobre valor pedido en COP", () => {
    const copPerUsd = 4000;
    const n = 938;
    const purchaseUsd = 738;
    const shippingCop = 376_204;
    const purchaseCop = purchaseUsd * copPerUsd;
    const ivaCopTotal = purchaseCop * IVA_RATE;

    const b = computeSimulatedRealPriceCop({
      pCop: 50_000,
      n,
      purchaseUsd,
      copPerUsd,
      shippingCop,
    });

    expect(b.shippingPerCard).toBeCloseTo(shippingCop / n, 8);
    expect(b.purchaseCopTotal).toBe(purchaseCop);
    expect(b.ivaCopTotal).toBeCloseTo(ivaCopTotal, 6);
    expect(b.ivaPerCard).toBeCloseTo(ivaCopTotal / n, 8);
    expect(b.totalCop).toBeCloseTo(
      50_000 + shippingCop / n + ivaCopTotal / n,
      6,
    );
  });

  it("envío/n + (valor COP × 19%) / n", () => {
    const copPerUsd = 4000;
    const purchaseCop = 100 * copPerUsd;
    const b = computeSimulatedRealPriceCop({
      pCop: 50_000,
      n: 2,
      purchaseUsd: 100,
      copPerUsd,
      shippingCop: 10_000,
    });
    expect(b.purchaseCopTotal).toBe(purchaseCop);
    expect(b.ivaCopTotal).toBe(purchaseCop * IVA_RATE);
    expect(b.ivaPerCard).toBe((purchaseCop * IVA_RATE) / 2);
    expect(b.shippingPerCard).toBe(5000);
  });

  it("pedido y envío en cero", () => {
    const b = computeSimulatedRealPriceCop({
      pCop: 80_000,
      n: 4,
      purchaseUsd: 0,
      copPerUsd: 4000,
      shippingCop: 0,
    });
    expect(b.purchaseCopTotal).toBe(0);
    expect(b.ivaCopTotal).toBe(0);
    expect(b.ivaPerCard).toBe(0);
    expect(b.totalCop).toBe(80_000);
  });
});

describe("resolveUsdCopRate", () => {
  it("corrige escala decimal típica (0.004 → 4000)", () => {
    const r = resolveUsdCopRate(0.004);
    expect(r.copPerUsd).toBe(4000);
    expect(r.kind).toBe("scaled");
    expect(r.wasAdjusted).toBe(true);
  });

  it("corrige tasa invertida (~1/4000)", () => {
    const r = resolveUsdCopRate(1 / 4000);
    expect(r.copPerUsd).toBe(4000);
    expect(r.kind).toBe("inverted");
  });

  it("deja valor típico sin tocar", () => {
    const r = resolveUsdCopRate(4150);
    expect(r.copPerUsd).toBe(4150);
    expect(r.wasAdjusted).toBe(false);
  });
});

describe("simulationNeedsWarning", () => {
  it("alerta si total negativo", () => {
    expect(
      simulationNeedsWarning({
        baseCop: 100,
        shippingCopTotal: 100,
        shippingPerCard: 10,
        purchaseCopTotal: 100,
        ivaCopTotal: -100,
        ivaPerCard: -500,
        totalCop: -390,
      }),
    ).toBe(true);
  });

  it("alerta si componente negativo", () => {
    expect(
      simulationNeedsWarning({
        baseCop: 100,
        shippingCopTotal: 0,
        shippingPerCard: -1,
        purchaseCopTotal: 0,
        ivaCopTotal: 0,
        ivaPerCard: 0,
        totalCop: 99,
      }),
    ).toBe(true);
  });

  it("sin alerta en caso típico", () => {
    expect(
      simulationNeedsWarning({
        baseCop: 100_000,
        shippingCopTotal: 20_000,
        shippingPerCard: 5_000,
        purchaseCopTotal: 1_000_000,
        ivaCopTotal: 190_000,
        ivaPerCard: 2_000,
        totalCop: 107_000,
      }),
    ).toBe(false);
  });
});

describe("parsers", () => {
  it("parsePositiveIntLoose", () => {
    expect(parsePositiveIntLoose("")).toBeNull();
    expect(parsePositiveIntLoose("0")).toBeNull();
    expect(parsePositiveIntLoose("3")).toBe(3);
  });

  it("parsePositiveNumberLoose", () => {
    expect(parsePositiveNumberLoose("0")).toBeNull();
    expect(parsePositiveNumberLoose("1,5")).toBe(1.5);
  });

  it("parseNonNegativeNumberLoose", () => {
    expect(parseNonNegativeNumberLoose("")).toBeNull();
    expect(parseNonNegativeNumberLoose("0")).toBe(0);
    expect(parseNonNegativeNumberLoose("12.5")).toBe(12.5);
    expect(parseNonNegativeNumberLoose("-1")).toBeNull();
  });
});
