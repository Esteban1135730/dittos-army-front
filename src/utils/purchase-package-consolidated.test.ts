import { describe, expect, it } from 'vitest';
import type { Ct0BoxItem } from './cardtrader-ct0-box';
import { buildPurchasePackages } from './purchase-package-consolidated';

const ct0Item = (partial: Partial<Ct0BoxItem> & Pick<Ct0BoxItem, 'id'>): Ct0BoxItem => ({
  id: partial.id,
  quantity: partial.quantity ?? { pending: 1 },
  product_id: 1,
  blueprint_id: 1,
  category_id: 1,
  game_id: 5,
  name: partial.name ?? 'Card',
  expansion: 'Set',
  buyer_price: partial.buyer_price ?? { cents: 100, currency: 'USD' },
  paid_at: partial.paid_at,
  properties: partial.properties,
  ...partial,
});

describe('purchase-package-consolidated', () => {
  it('agrupa CT Zero por paid_at con hub y listas', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const normalizedKey = '2026-05-29T15:33:00.000Z'; // segundos truncados a 0
    const { packages } = buildPurchasePackages({
      ct0Items: [
        ct0Item({
          id: 1,
          paid_at: paidAt,
          quantity: { pending: 4, ok: 2 },
          name: 'Crushing Hammer',
          buyer_price: { cents: 47, currency: 'USD' },
        }),
        ct0Item({
          id: 2,
          paid_at: '2026-05-28T10:00:00.000Z',
          quantity: { pending: 1 },
          name: 'Switch',
        }),
      ],
      copByPackageKey: {},
      parseCop: () => null,
      readCondition: () => 'NM',
      readLanguage: () => 'en',
      variantLabel: () => '—',
    });

    expect(packages).toHaveLength(2);
    expect(packages[0].packageKey).toBe(normalizedKey);
    expect(packages[0].lines).toHaveLength(2);
    expect(packages[0].locations).toContain('ct0-hub');
    expect(packages[0].locations).toContain('ct0-ready');
  });

  it('agrupa ítems del mismo checkout con segundos distintos en un solo paquete', () => {
    const { packages } = buildPurchasePackages({
      ct0Items: [
        ct0Item({ id: 1, paid_at: '2026-07-05T22:57:30.000Z', quantity: { pending: 1 } }),
        ct0Item({ id: 2, paid_at: '2026-07-05T22:57:45.000Z', quantity: { pending: 1 } }),
      ],
      copByPackageKey: {},
      parseCop: () => null,
      readCondition: () => 'NM',
      readLanguage: () => 'en',
      variantLabel: () => '—',
    });

    expect(packages).toHaveLength(1);
    expect(packages[0].lines).toHaveLength(2);
  });

  it('reparte COP proporcional al precio CT', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const normalizedKey = '2026-05-29T15:33:00.000Z';
    const { packages } = buildPurchasePackages({
      ct0Items: [
        ct0Item({
          id: 1,
          paid_at: paidAt,
          quantity: { pending: 1 },
          buyer_price: { cents: 100, currency: 'USD' },
        }),
        ct0Item({
          id: 2,
          paid_at: paidAt,
          quantity: { pending: 1 },
          buyer_price: { cents: 300, currency: 'USD' },
        }),
      ],
      copByPackageKey: { [normalizedKey]: '400000' },
      parseCop: (raw) => Number(raw),
      readCondition: () => 'NM',
      readLanguage: () => 'en',
      variantLabel: () => '—',
    });

    const lines = packages[0].lines;
    expect(lines[0].lineCostCop).toBeCloseTo(100000, 0);
    expect(lines[1].lineCostCop).toBeCloseTo(300000, 0);
  });

  it('usa unit_cost_cop del lote panel cuando hay match por nombre', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const normalizedKey = '2026-05-29T15:33:00.000Z';
    const { packages } = buildPurchasePackages({
      ct0Items: [
        ct0Item({
          id: 1,
          paid_at: paidAt,
          name: 'Crushing Hammer',
          quantity: { pending: 2 },
          buyer_price: { cents: 47, currency: 'USD' },
        }),
      ],
      copByPackageKey: {},
      batchItemsByPackageKey: {
        [normalizedKey]: [
          {
            batch_item_id: 'a',
            card_id: 'x',
            card_name: 'Crushing Hammer',
            language: 'en',
            quantity_ordered: 2,
            remaining_quantity: 2,
            unit_cost_cop: 12500,
          },
        ],
      },
      parseCop: () => null,
      readCondition: () => 'NM',
      readLanguage: () => 'en',
      variantLabel: () => '—',
    });

    expect(packages[0].lines[0].unitCostCop).toBe(12500);
    expect(packages[0].lines[0].lineCostCop).toBe(25000);
  });
});
