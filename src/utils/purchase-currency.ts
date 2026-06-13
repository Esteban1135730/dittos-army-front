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
