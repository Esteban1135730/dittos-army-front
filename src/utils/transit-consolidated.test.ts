import { describe, expect, it } from 'vitest';
import type { Ct0BoxItem } from './cardtrader-ct0-box';
import {
  buildConsolidatedTransit,
  type IncomingBatchLine,
  type IncomingOpenBatch,
} from './transit-consolidated';

const ct0Item = (partial: Partial<Ct0BoxItem> & Pick<Ct0BoxItem, 'id'>): Ct0BoxItem => ({
  id: partial.id,
  quantity: partial.quantity ?? { pending: 1 },
  product_id: 1,
  blueprint_id: 1,
  category_id: 1,
  game_id: 5,
  name: partial.name ?? 'Pikachu',
  expansion: 'Base',
  buyer_price: partial.buyer_price ?? { cents: 100, currency: 'USD' },
  paid_at: partial.paid_at,
  properties: partial.properties,
  ...partial,
});

describe('transit-consolidated', () => {
  it('une lotes CT Zero e incoming en consolidado total', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const ct0: Ct0BoxItem[] = [
      ct0Item({ id: 1, paid_at: paidAt, quantity: { pending: 2 }, name: 'Switch' }),
    ];
    const batches: IncomingOpenBatch[] = [
      {
        batch_id: 'b1',
        status: 'open',
        purchase_date: '2026-05-01',
        created_at: '2026-05-01',
        total_eur_cards_cost: 10,
        total_cop_cards_cost: 45000,
        remaining_total_quantity: 3,
      },
    ];
    const itemsByBatch: Record<string, IncomingBatchLine[]> = {
      b1: [
        {
          batch_item_id: 'i1',
          batch_id: 'b1',
          card_id: 'base1-58',
          card_name: 'Pikachu',
          image_url: '',
          language: 'en',
          quantity_ordered: 3,
          remaining_quantity: 3,
          eur_total_lot: 10,
          eur_unit_price: 3.33,
          unit_cost_cop: 15000,
          rareza: null,
          created_at: '2026-05-01',
        },
      ],
    };

    const { lots, summary } = buildConsolidatedTransit({
      ct0Items: ct0,
      incomingBatches: batches,
      incomingItemsByBatch: itemsByBatch,
      filter: 'all',
      copByCt0LotKey: {},
      parseCop: () => null,
      readCondition: () => 'NM',
      readLanguage: () => 'en',
      variantLabel: () => 'Sin variante',
    });

    expect(lots).toHaveLength(2);
    expect(summary.totalUnits).toBe(5);
    expect(summary.lotCount).toBe(2);
  });
});
