/** Simulación de costo/precio real aproximado (COP) — feature 005. */

/** Rango típico COP por 1 USD (Colombia); fuera de esto suele habla error de captura o escala. */
export const USD_COP_TYPICAL_MIN = 500;
export const USD_COP_TYPICAL_MAX = 50000;

/**
 * Normaliza el valor guardado en sesión como "USD → COP".
 * Corrige: (1) tasa invertida (~1/4000), (2) escala decimal errónea (0.004 vs 4000).
 */
export function resolveUsdCopRate(raw: number): {
  copPerUsd: number;
  wasAdjusted: boolean;
  kind: "as_is" | "inverted" | "scaled";
} {
  if (!Number.isFinite(raw) || raw <= 0) {
    return { copPerUsd: raw, wasAdjusted: false, kind: "as_is" };
  }
  if (raw >= USD_COP_TYPICAL_MIN && raw <= USD_COP_TYPICAL_MAX) {
    return { copPerUsd: raw, wasAdjusted: false, kind: "as_is" };
  }
  const inv = 1 / raw;
  if (inv >= USD_COP_TYPICAL_MIN && inv <= USD_COP_TYPICAL_MAX) {
    return { copPerUsd: inv, wasAdjusted: true, kind: "inverted" };
  }
  let x = raw;
  let guard = 0;
  while (x > 0 && x < USD_COP_TYPICAL_MIN && guard++ < 28) {
    x *= 10;
  }
  while (x > USD_COP_TYPICAL_MAX && guard++ < 56) {
    x /= 10;
  }
  if (x >= USD_COP_TYPICAL_MIN && x <= USD_COP_TYPICAL_MAX) {
    return { copPerUsd: x, wasAdjusted: true, kind: "scaled" };
  }
  return { copPerUsd: raw, wasAdjusted: false, kind: "as_is" };
}

/** IVA sobre valor del pedido ya expresado en COP (simulación). */
export const IVA_RATE = 0.19;

export type SimulateRealPriceInput = {
  /** Precio carta COP (unit_cost_cop) */
  pCop: number;
  /** Cartas esperadas en el envío */
  n: number;
  /** Valor total del pedido / cartas en USD → se pasa a COP y ahí se aplica el IVA */
  purchaseUsd: number;
  /** COP por 1 USD — desde sesión (`usd-cop-rate`) */
  copPerUsd: number;
  /** Costo total de envío en COP */
  shippingCop: number;
};

export type SimulateRealPriceBreakdown = {
  baseCop: number;
  shippingCopTotal: number;
  /** Envío total COP / n */
  shippingPerCard: number;
  /** Valor pedido en COP (USD × tasa) */
  purchaseCopTotal: number;
  /** IVA total COP = purchaseCopTotal × 19% */
  ivaCopTotal: number;
  /** IVA por carta */
  ivaPerCard: number;
  totalCop: number;
};

/**
 * Total COP ≈ P_COP + envío/n + ((valor_USD × COP/USD × 0.19) / n)
 */
export function computeSimulatedRealPriceCop(
  input: SimulateRealPriceInput,
): SimulateRealPriceBreakdown {
  const { pCop, n, purchaseUsd, copPerUsd, shippingCop } = input;
  const shippingPerCard = shippingCop / n;
  const purchaseCopTotal = purchaseUsd * copPerUsd;
  const ivaCopTotal = purchaseCopTotal * IVA_RATE;
  const ivaPerCard = ivaCopTotal / n;
  const totalCop = pCop + shippingPerCard + ivaPerCard;
  return {
    baseCop: pCop,
    shippingCopTotal: shippingCop,
    shippingPerCard,
    purchaseCopTotal,
    ivaCopTotal,
    ivaPerCard,
    totalCop,
  };
}

/** Resultado con advertencias según spec (total negativo o desglose fuerte). */
export function simulationNeedsWarning(b: SimulateRealPriceBreakdown): boolean {
  if (b.totalCop < 0) return true;
  if (b.ivaPerCard < 0 || b.shippingPerCard < 0) return true;
  return false;
}

export function rateLooksSuspicious(copPerUsd: number): boolean {
  return (
    !Number.isFinite(copPerUsd) ||
    copPerUsd < USD_COP_TYPICAL_MIN ||
    copPerUsd > USD_COP_TYPICAL_MAX
  );
}

export function parsePositiveIntLoose(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function parsePositiveNumberLoose(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Permite 0 para montos opcionales si en el futuro se usa; para inputs actuales usar parsePositiveNumberLoose. */
export function parseNonNegativeNumberLoose(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
