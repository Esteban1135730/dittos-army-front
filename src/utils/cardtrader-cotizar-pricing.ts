/** IVA (alineado con simulación de incoming del panel). */
export const CARDTRADER_IVA_RATE = 0.19;

/** Envío estimado por carta (COP). */
export const CARDTRADER_SHIPPING_COP_PER_UNIT = 900;

/** Margen sobre costo real para PVP aproximado. */
export const CARDTRADER_PVP_MARKUP = 0.3;

export type CardtraderLineCostBreakdown = {
  /** Precio de la carta en COP (sin envío ni IVA). */
  purchaseCop: number;
  shippingCop: number;
  subtotalBeforeIva: number;
  ivaCop: number;
  /** Envío estimado + IVA (aprox.). */
  ivaPlusShippingCop: number;
  realCostCop: number;
  pvpApproxCop: number;
};

/**
 * Costo real aprox. por unidad: (precio en COP + envío) × (1 + IVA).
 * PVP aprox.: costo real × (1 + 30%).
 */
export function computeCardtraderUnitCostCop(purchaseCopPerUnit: number): CardtraderLineCostBreakdown {
  const shippingCop = CARDTRADER_SHIPPING_COP_PER_UNIT;
  const subtotalBeforeIva = purchaseCopPerUnit + shippingCop;
  const ivaCop = subtotalBeforeIva * CARDTRADER_IVA_RATE;
  const realCostCop = subtotalBeforeIva + ivaCop;
  const pvpApproxCop = realCostCop * (1 + CARDTRADER_PVP_MARKUP);
  return {
    purchaseCop: purchaseCopPerUnit,
    shippingCop,
    subtotalBeforeIva,
    ivaCop,
    ivaPlusShippingCop: shippingCop + ivaCop,
    realCostCop,
    pvpApproxCop,
  };
}

export function computeCardtraderLineCostCop(
  purchaseCopPerUnit: number,
  qty: number,
): CardtraderLineCostBreakdown {
  const unit = computeCardtraderUnitCostCop(purchaseCopPerUnit);
  const q = Math.max(1, qty);
  return {
    purchaseCop: unit.purchaseCop * q,
    shippingCop: unit.shippingCop * q,
    subtotalBeforeIva: unit.subtotalBeforeIva * q,
    ivaCop: unit.ivaCop * q,
    ivaPlusShippingCop: unit.ivaPlusShippingCop * q,
    realCostCop: unit.realCostCop * q,
    pvpApproxCop: unit.pvpApproxCop * q,
  };
}
