export type CardsCostCurrency = 'EUR' | 'USD';

export function normalizeCardsCostCurrency(raw: unknown): CardsCostCurrency {
  const c = String(raw ?? 'EUR')
    .trim()
    .toUpperCase();
  if (c === 'USD') return 'USD';
  return 'EUR';
}

export function fxSymbol(currency: CardsCostCurrency): string {
  return currency === 'USD' ? '$' : '€';
}

export function formatFx(
  value: number | null | undefined,
  currency: CardsCostCurrency = 'EUR',
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${fxSymbol(currency)}${value.toFixed(2)}`;
}

export function formatCopRateFx(
  value: number | null | undefined,
  currency: CardsCostCurrency = 'EUR',
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('es-CO')} COP/${currency}`;
}

/** COP/ud = precio FX/ud × tasa fija del lote (no repartir COP total entre cartas restantes). */
export function unitCostCopFromFxUnit(
  fxUnitPrice: number | null | undefined,
  realFxRateCop: number | null | undefined,
): number | null {
  if (fxUnitPrice == null || !Number.isFinite(fxUnitPrice) || fxUnitPrice <= 0) {
    return null;
  }
  if (realFxRateCop == null || !Number.isFinite(realFxRateCop) || realFxRateCop <= 0) {
    return null;
  }
  return fxUnitPrice * realFxRateCop;
}

/** Tasa COP/FX inferida del registro original de la carta (regla de tres). */
export function inferredFxRateCopFromBatchItem(item: {
  unit_cost_cop?: number | null;
  eur_unit_price?: number | null;
}): number | null {
  const cop = item.unit_cost_cop;
  const fx = item.eur_unit_price;
  if (cop == null || cop <= 0 || fx == null || fx <= 0) return null;
  return cop / fx;
}

/**
 * COP/ud para precio CT0 usando la tasa de esa carta en el lote legacy:
 * ctFxUnit × (legacyCop / legacyFx).
 */
export function unitCostCopFromBatchItemRuleOfThree(
  ctFxUnit: number,
  item: { unit_cost_cop?: number | null; eur_unit_price?: number | null },
): number | null {
  const rate = inferredFxRateCopFromBatchItem(item);
  if (rate == null || !Number.isFinite(ctFxUnit) || ctFxUnit <= 0) return null;
  return ctFxUnit * rate;
}

export function resolveUnitCostCopFromBatchItem(
  item: { eur_unit_price?: number | null; unit_cost_cop?: number | null },
  ctFxUnit?: number | null,
  lotFxRateFallback?: number | null,
): number {
  const fxUnit =
    ctFxUnit != null && ctFxUnit > 0
      ? ctFxUnit
      : item.eur_unit_price != null && item.eur_unit_price > 0
        ? item.eur_unit_price
        : 0;

  const fromItemRule = unitCostCopFromBatchItemRuleOfThree(fxUnit, item);
  if (fromItemRule != null) return fromItemRule;

  const fromLotRate = unitCostCopFromFxUnit(fxUnit, lotFxRateFallback);
  if (fromLotRate != null) return fromLotRate;

  return Math.max(0, Number(item.unit_cost_cop) || 0);
}

export function fxUnitPriceFromSentUnit(unit: {
  unit_price_fx?: number | null;
  unit_price_eur?: number | null;
  purchase_price_fx?: number | null;
  purchase_price_eur?: number | null;
  price_currency?: string | null;
  purchase_price_currency?: string | null;
}): { amount: number | null; currency: CardsCostCurrency } {
  const currency = normalizeCardsCostCurrency(
    unit.purchase_price_currency ?? unit.price_currency ?? 'USD',
  );
  const candidates = [
    unit.purchase_price_fx,
    unit.unit_price_fx,
    unit.purchase_price_eur,
    unit.unit_price_eur,
  ];
  for (const value of candidates) {
    if (value != null && value > 0) {
      return { amount: value, currency };
    }
  }
  return { amount: null, currency };
}
