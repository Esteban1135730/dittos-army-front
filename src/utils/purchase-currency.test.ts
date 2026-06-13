import { describe, expect, it } from 'vitest';
import { fxUnitPriceFromSentUnit } from './purchase-currency';

describe('fxUnitPriceFromSentUnit', () => {
  it('muestra precio USD guardado en unit_price_eur (legacy)', () => {
    const r = fxUnitPriceFromSentUnit({
      unit_price_eur: 0.9,
      unit_price_fx: null,
      price_currency: 'USD',
    });
    expect(r.amount).toBe(0.9);
    expect(r.currency).toBe('USD');
  });

  it('prioriza unit_price_fx cuando existe', () => {
    const r = fxUnitPriceFromSentUnit({
      unit_price_fx: 1.2,
      unit_price_eur: 0.9,
      price_currency: 'USD',
    });
    expect(r.amount).toBe(1.2);
  });
});
