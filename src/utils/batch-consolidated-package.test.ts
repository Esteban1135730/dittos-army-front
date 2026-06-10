import { describe, expect, it } from 'vitest';
import type { Ct0BoxItem } from './cardtrader-ct0-box';
import { buildBatchConsolidatedPackages, groupBatchConsolidatedLines } from './batch-consolidated-package';
import { buildOrderTransitPackages } from './order-transit-packages';

const ct0 = (partial: Partial<Ct0BoxItem>): Ct0BoxItem => ({
  id: partial.id ?? 1,
  quantity: partial.quantity ?? { ok: 1 },
  product_id: 1,
  blueprint_id: partial.blueprint_id ?? 1,
  category_id: 1,
  game_id: 5,
  name: partial.name ?? 'Card',
  expansion: 'Set',
  buyer_price: partial.buyer_price ?? { cents: 100, currency: 'USD' },
  properties: partial.properties ?? { pokemon_language: 'en' },
  ...partial,
});

describe('batch-consolidated-package', () => {
  it('arma lote desde panel, cruza CT Zero y pedidos en camino', () => {
    const { packages, soloCardtrader } = buildBatchConsolidatedPackages({
      bundles: [
        {
          batchId: 'batch-1',
          purchaseDate: '2026-05-28',
          totalCopCardsCost: 50000,
          items: [
            {
              batch_item_id: 'a',
              card_id: 'x1',
              card_name: 'Pikachu',
              language: 'en',
              quantity_ordered: 1,
              remaining_quantity: 1,
              unit_cost_cop: 10000,
              eur_unit_price: 2.5,
            },
            {
              batch_item_id: 'b',
              card_id: 'x2',
              card_name: 'Solo Panel',
              language: 'en',
              quantity_ordered: 1,
              remaining_quantity: 1,
              unit_cost_cop: 8000,
            },
          ],
        },
      ],
      ct0Items: [
        ct0({ id: 1, name: 'Pikachu', quantity: { ok: 1 }, blueprint_id: 10 }),
      ],
      orderPackages: buildOrderTransitPackages([
        {
          id: 99,
          code: 'ORD-1',
          state: 'sent',
          order_as: 'buyer',
          size: 1,
          order_items: [
            {
              id: 100,
              product_id: 1,
              blueprint_id: 20,
              category_id: 1,
              game_id: 5,
              name: 'Mewtwo',
              expansion: 'Set',
              quantity: 1,
              buyer_price: { cents: 300, currency: 'EUR' },
              properties: { pokemon_language: 'en' },
            },
          ],
        },
      ]),
      readCt0Language: (item) => String(item.properties?.pokemon_language ?? 'en'),
    });

    expect(packages).toHaveLength(1);
    const pikachu = packages[0].lines.find((l) => l.cardName === 'Pikachu');
    const soloPanel = packages[0].lines.find((l) => l.cardName === 'Solo Panel');

    expect(pikachu?.ct0Units).toBe(1);
    expect(pikachu?.panelOnlyUnits).toBe(0);
    expect(soloPanel?.panelOnlyUnits).toBe(1);
    expect(soloCardtrader.some((l) => l.name === 'Mewtwo')).toBe(true);

    const groups = groupBatchConsolidatedLines(packages[0].lines);
    expect(groups.soloRegistro.map((l) => l.cardName)).toEqual(['Solo Panel']);
    expect(groups.conEnvio).toHaveLength(0);
    expect(groups.otras.map((l) => l.cardName)).toEqual(['Pikachu']);
  });
});
