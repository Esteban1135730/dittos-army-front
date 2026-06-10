import { describe, expect, it } from 'vitest';
import {
  allocateCt0CopToItems,
  ct0ItemQtyForState,
  filterCt0BoxItems,
  groupCt0ItemsIntoLots,
  summarizeCt0BoxItems,
  type Ct0BoxItem,
} from './cardtrader-ct0-box';

const item = (partial: Partial<Ct0BoxItem> & Pick<Ct0BoxItem, 'id'>): Ct0BoxItem => ({
  id: partial.id,
  quantity: partial.quantity ?? { ok: 1 },
  product_id: 1,
  blueprint_id: 1,
  category_id: 1,
  game_id: 5,
  name: partial.name ?? 'Pikachu',
  expansion: 'Base Set',
  buyer_price: partial.buyer_price ?? { cents: 100, currency: 'USD' },
  ...partial,
});

describe('cardtrader-ct0-box', () => {
  it('filtra por estado ok/pending', () => {
    const items = [
      item({ id: 1, quantity: { ok: 2 } }),
      item({ id: 2, quantity: { pending: 1 } }),
    ];
    expect(filterCt0BoxItems(items, 'ok')).toHaveLength(1);
    expect(filterCt0BoxItems(items, 'pending')).toHaveLength(1);
  });

  it('resume unidades y USD por estado', () => {
    const items = [
      item({ id: 1, quantity: { ok: 3 }, buyer_price: { cents: 816, currency: 'USD' } }),
      item({ id: 2, quantity: { ok: 1 }, buyer_price: { cents: 547, currency: 'USD' } }),
    ];
    const s = summarizeCt0BoxItems(items, 'ok');
    expect(s.units).toBe(4);
    expect(s.itemLines).toBe(2);
    expect(s.totalUsd).toBeCloseTo(29.95, 2);
  });

  it('reparte COP proporcional al peso USD', () => {
    const items = [
      item({ id: 1, quantity: { ok: 1 }, buyer_price: { cents: 800, currency: 'USD' } }),
      item({ id: 2, quantity: { ok: 1 }, buyer_price: { cents: 200, currency: 'USD' } }),
    ];
    const result = allocateCt0CopToItems(items, 'ok', 50_000);
    expect(result.lines[0].lineCop).toBeCloseTo(40_000, 0);
    expect(result.lines[1].lineCop).toBeCloseTo(10_000, 0);
    expect(result.implicitRateCopPerUsd).toBeCloseTo(5_000, 0);
  });

  it('agrupa ítems con mismo paid_at en un lote', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const items = [
      item({ id: 1, paid_at: paidAt, quantity: { pending: 4 }, name: 'Crushing Hammer' }),
      item({ id: 2, paid_at: paidAt, quantity: { pending: 2 }, name: 'Switch' }),
      item({ id: 3, paid_at: '2026-05-20T01:00:46.000Z', quantity: { pending: 1 }, name: 'Otro' }),
    ];
    const lots = groupCt0ItemsIntoLots(items, 'pending');
    expect(lots).toHaveLength(2);
    const lot = lots.find((l) => l.paidAt === paidAt);
    expect(lot?.productLines).toBe(2);
    expect(lot?.units).toBe(6);
  });

  it('ct0ItemQtyForState lee quantity del estado', () => {
    expect(ct0ItemQtyForState(item({ id: 1, quantity: { pending: 2 } }), 'pending')).toBe(2);
    expect(ct0ItemQtyForState(item({ id: 1, quantity: { pending: 2 } }), 'ok')).toBe(0);
  });
});
