/** Envío fijo estimado por carta (COP). */
export const CARDTRADER_SHIPPING_COP_PER_UNIT = 900;

/**
 * Comisión CardTrader de respaldo (5%) cuando aún no hay fee del carrito.
 * Con carrito cargado debe usarse el fee real de CT, no este estimado.
 */
export const CARDTRADER_CARD_FEE_RATE = 0.05;

/** Margen sobre costo unitario para PVP sugerido (+30%). */
export const CARDTRADER_SUGGESTED_PVP_MARGIN = 0.3;

export type CardtraderLineCostBreakdown = {
  /** Precio de la carta en COP (base). */
  purchaseCop: number;
  /** Comisión CardTrader (fee real del carrito prorrateado, o 5% estimado). */
  feeCop: number;
  /** Envío estimado por unidad (900 COP). */
  shippingCop: number;
  /** Comisión + envío. */
  feePlusShippingCop: number;
  /** Costo unitario: base + comisión + envío. */
  realCostCop: number;
  /** PVP sugerido: costo unitario × (1 + 30%). */
  pvpApproxCop: number;
};

export type CardtraderCartFeeAllocationLine = {
  /** Base COP por unidad. */
  purchaseCop: number;
  qty: number;
};

/**
 * Costo unitario: base COP + comisión + 900 COP envío.
 * Si `feeCopPerUnit` viene informado (prorrateo del fee del carrito), se usa tal cual.
 * Si no, estima 5% sobre la base.
 * PVP sugerido: costo unitario × (1 + 30%).
 */
export function computeCardtraderUnitCostCop(
  purchaseCopPerUnit: number,
  feeCopPerUnit?: number,
): CardtraderLineCostBreakdown {
  const shippingCop = CARDTRADER_SHIPPING_COP_PER_UNIT;
  const feeCop =
    feeCopPerUnit != null && Number.isFinite(feeCopPerUnit)
      ? feeCopPerUnit
      : purchaseCopPerUnit * CARDTRADER_CARD_FEE_RATE;
  const feePlusShippingCop = feeCop + shippingCop;
  const realCostCop = purchaseCopPerUnit + feeCop + shippingCop;
  const pvpApproxCop = realCostCop * (1 + CARDTRADER_SUGGESTED_PVP_MARGIN);
  return {
    purchaseCop: purchaseCopPerUnit,
    feeCop,
    shippingCop,
    feePlusShippingCop,
    realCostCop,
    pvpApproxCop,
  };
}

/**
 * Reparte el fee total del carrito (COP) entre líneas.
 * Devuelve comisión **por unidad** de cada línea, de modo que
 * Σ (feePerUnit × qty) === totalFeeCop (salvo redondeo residual en la última línea).
 */
export function allocateCartFeePerUnitCop(
  lines: CardtraderCartFeeAllocationLine[],
  totalFeeCop: number,
): number[] {
  if (lines.length === 0) return [];
  if (!(totalFeeCop > 0) || !Number.isFinite(totalFeeCop)) {
    return lines.map(() => 0);
  }

  const weights = lines.map((ln) => {
    const q = Math.max(1, ln.qty);
    const purchase = Number.isFinite(ln.purchaseCop) ? Math.max(0, ln.purchaseCop) : 0;
    return purchase * q;
  });
  let weightSum = weights.reduce((s, w) => s + w, 0);
  if (!(weightSum > 0)) {
    const qtyWeights = lines.map((ln) => Math.max(1, ln.qty));
    weightSum = qtyWeights.reduce((s, w) => s + w, 0);
    const out: number[] = [];
    let allocated = 0;
    for (let i = 0; i < lines.length; i++) {
      const q = qtyWeights[i];
      const isLast = i === lines.length - 1;
      const lineFee = isLast
        ? totalFeeCop - allocated
        : (totalFeeCop * q) / weightSum;
      if (!isLast) allocated += lineFee;
      out.push(lineFee / q);
    }
    return out;
  }

  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < lines.length; i++) {
    const q = Math.max(1, lines[i].qty);
    const isLast = i === lines.length - 1;
    const lineFee = isLast
      ? totalFeeCop - allocated
      : (totalFeeCop * weights[i]) / weightSum;
    if (!isLast) allocated += lineFee;
    out.push(lineFee / q);
  }
  return out;
}

export function computeCardtraderLineCostCop(
  purchaseCopPerUnit: number,
  qty: number,
  feeCopPerUnit?: number,
): CardtraderLineCostBreakdown {
  const unit = computeCardtraderUnitCostCop(purchaseCopPerUnit, feeCopPerUnit);
  const q = Math.max(1, qty);
  return {
    purchaseCop: unit.purchaseCop * q,
    feeCop: unit.feeCop * q,
    shippingCop: unit.shippingCop * q,
    feePlusShippingCop: unit.feePlusShippingCop * q,
    realCostCop: unit.realCostCop * q,
    pvpApproxCop: unit.pvpApproxCop * q,
  };
}
