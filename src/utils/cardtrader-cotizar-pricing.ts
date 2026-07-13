/** IVA (alineado con simulación de incoming del panel). */
export const CARDTRADER_IVA_RATE = 0.19;

/** Envío estimado por carta (COP) para IVA / costo real / PVP. */
export const CARDTRADER_SHIPPING_COP_PER_UNIT = 900;

/** Envío fijo (COP) para «precio solo con envío» en cotización. */
export const CARDTRADER_SHIPPING_ONLY_COP = 700;

/** Comisión CardTrader sobre el precio de la carta (solo envío). */
export const CARDTRADER_CARD_FEE_RATE = 0.05;

/** Margen sobre costo real para PVP aproximado. */
export const CARDTRADER_PVP_MARKUP = 0.3;

export type CardtraderLineCostBreakdown = {
  /** Precio de la carta en COP (sin envío ni IVA). */
  purchaseCop: number;
  /** Precio carta + envío fijo + comisión carta (sin IVA). */
  priceShippingOnlyCop: number;
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
  const priceShippingOnlyCop =
    purchaseCopPerUnit * (1 + CARDTRADER_CARD_FEE_RATE) + CARDTRADER_SHIPPING_ONLY_COP;
  const subtotalBeforeIva = purchaseCopPerUnit + shippingCop;
  const ivaCop = subtotalBeforeIva * CARDTRADER_IVA_RATE;
  const realCostCop = subtotalBeforeIva + ivaCop;
  const pvpApproxCop = realCostCop * (1 + CARDTRADER_PVP_MARKUP);
  return {
    purchaseCop: purchaseCopPerUnit,
    priceShippingOnlyCop,
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
    priceShippingOnlyCop: unit.priceShippingOnlyCop * q,
    shippingCop: unit.shippingCop * q,
    subtotalBeforeIva: unit.subtotalBeforeIva * q,
    ivaCop: unit.ivaCop * q,
    ivaPlusShippingCop: unit.ivaPlusShippingCop * q,
    realCostCop: unit.realCostCop * q,
    pvpApproxCop: unit.pvpApproxCop * q,
  };
}
