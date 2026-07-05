import { describe, expect, it } from 'vitest';
import type { Ct0BoxItem } from './cardtrader-ct0-box';
import { buildBatchConsolidatedPackages, groupBatchConsolidatedLines } from './batch-consolidated-package';
import { buildOrderTransitPackages } from './order-transit-packages';
import { buildExpansionHomologIndex } from './transit-card-match';

const holonHomolog = buildExpansionHomologIndex([
  { tcgdxSetId: 'ex13', aliases: ['EX Holon Phantoms', 'Holon Phantoms'] },
  { tcgdxSetId: 'ex16', aliases: ['EX Power Keepers', 'Power Keepers'] },
]);

const withHomolog = <T extends object>(args: T) => ({
  ...args,
  expansionHomolog: holonHomolog,
  readCt0Language: (item: { properties?: Record<string, unknown> }) =>
    String(item.properties?.pokemon_language ?? 'en'),
});

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
  it('usa regla de tres por carta (COP÷FX del ítem), no tasa global del lote', () => {
    const { packages } = buildBatchConsolidatedPackages(
      withHomolog({
        bundles: [
          {
            batchId: 'batch-rate',
            purchaseDate: '2026-04-09',
            totalCopCardsCost: 400000,
            totalFxCardsCost: 100,
            realFxRateCop: 4000,
            cardsCostCurrency: 'USD',
            items: [
              {
                batch_item_id: 'i1',
                card_id: 'c1',
                card_name: 'Petrel',
                language: 'en',
                quantity_ordered: 5,
                remaining_quantity: 1,
                unit_cost_cop: 2231,
                eur_unit_price: 0.89,
              },
            ],
          },
        ],
        ct0Items: [],
        orderPackages: [],
      }),
    );

    expect(packages[0].lines[0].unitCostCop).toBe(2231);
    expect(packages[0].realCopTotal).toBe(2231);
  });

  it('arma lote desde panel, cruza CT Zero y pedidos en camino', () => {
    const { packages, soloCardtrader } = buildBatchConsolidatedPackages(withHomolog({
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
    }));

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

  it('empareja por nombre con precio cercano en segunda pasada', () => {
    const { packages, soloCardtrader } = buildBatchConsolidatedPackages(withHomolog({
      bundles: [
        {
          batchId: 'batch-1',
          purchaseDate: '2026-06-05',
          items: [
            {
              batch_item_id: 'a',
              card_id: 'x1',
              card_name: 'Dreepy',
              language: 'en',
              quantity_ordered: 1,
              remaining_quantity: 1,
              unit_cost_cop: 4000,
              eur_unit_price: 0.9,
            },
          ],
        },
      ],
      ct0Items: [],
      orderPackages: buildOrderTransitPackages([
        {
          id: 99,
          code: 'ORD-1',
          state: 'sent',
          order_as: 'buyer',
          size: 1,
          paid_at: '2026-06-05T01:42:06.000Z',
          order_items: [
            {
              id: 100,
              product_id: 1,
              blueprint_id: 20,
              category_id: 1,
              game_id: 5,
              name: 'Dreepy',
              expansion: 'Set',
              quantity: 1,
              buyer_price: { cents: 110, currency: 'EUR' },
              properties: { pokemon_language: 'en' },
            },
          ],
        },
      ]),
    }));

    const line = packages[0].lines[0];
    expect(line.orderUnits).toBe(1);
    expect(line.panelOnlyUnits).toBe(0);
    expect(soloCardtrader.filter((l) => l.source === 'order')).toHaveLength(0);
  });

  it('reconcilia pedidos sobrantes con líneas solo-registro de otro lote', () => {
    const { packages, soloCardtrader } = buildBatchConsolidatedPackages(withHomolog({
      bundles: [
        {
          batchId: 'batch-new',
          purchaseDate: '2026-06-10',
          items: [
            {
              batch_item_id: 'other',
              card_id: 'z1',
              card_name: 'Other Card',
              language: 'en',
              quantity_ordered: 1,
              remaining_quantity: 1,
              unit_cost_cop: 5000,
              eur_unit_price: 1,
            },
          ],
        },
        {
          batchId: 'batch-old',
          purchaseDate: '2026-06-05',
          items: [
            {
              batch_item_id: 'a',
              card_id: 'x1',
              card_name: 'Dusclops',
              language: 'en',
              quantity_ordered: 1,
              remaining_quantity: 1,
              unit_cost_cop: 3000,
              eur_unit_price: 0.54,
            },
          ],
        },
      ],
      ct0Items: [],
      orderPackages: buildOrderTransitPackages([
        {
          id: 99,
          code: 'ORD-1',
          state: 'sent',
          order_as: 'buyer',
          size: 1,
          paid_at: '2026-06-05T01:42:06.000Z',
          order_items: [
            {
              id: 100,
              product_id: 1,
              blueprint_id: 20,
              category_id: 1,
              game_id: 5,
              name: 'Dusclops',
              expansion: 'Set',
              quantity: 1,
              buyer_price: { cents: 54, currency: 'EUR' },
              properties: { pokemon_language: 'en' },
            },
          ],
        },
      ]),
    }));

    const oldBatch = packages.find((p) => p.batchId === 'batch-old');
    const line = oldBatch?.lines.find((l) => l.cardName === 'Dusclops');
    expect(line?.orderUnits).toBe(1);
    expect(line?.panelOnlyUnits).toBe(0);
    expect(soloCardtrader.filter((l) => l.source === 'order')).toHaveLength(0);
  });

  it('empareja Anorith δ (TCGdex) con Anorith δ Delta Species (CardTrader)', () => {
    const { packages, soloCardtrader } = buildBatchConsolidatedPackages(withHomolog({
      bundles: [
        {
          batchId: 'batch-1',
          purchaseDate: '2026-06-05',
          items: [
            {
              batch_item_id: 'a',
              card_id: 'ex13-57',
              card_name: 'Anorith δ',
              language: 'en',
              quantity_ordered: 1,
              remaining_quantity: 1,
              unit_cost_cop: 1000,
              eur_unit_price: 0.25,
            },
          ],
        },
      ],
      ct0Items: [],
      orderPackages: buildOrderTransitPackages([
        {
          id: 99,
          code: 'ORD-1',
          state: 'sent',
          order_as: 'buyer',
          size: 1,
          paid_at: '2026-06-05T01:42:06.000Z',
          order_items: [
            {
              id: 100,
              product_id: 1,
              blueprint_id: 20,
              category_id: 1,
              game_id: 5,
              name: 'Anorith δ Delta Species',
              expansion: 'EX Holon Phantoms',
              quantity: 1,
              buyer_price: { cents: 25, currency: 'USD' },
              properties: { pokemon_language: 'en', collector_number: '57' },
            },
          ],
        },
      ]),
    }));

    const line = packages[0].lines[0];
    expect(line.orderUnits).toBe(1);
    expect(line.panelOnlyUnits).toBe(0);
    expect(soloCardtrader.filter((l) => l.name.includes('Anorith'))).toHaveLength(0);
  });

  it('no confunde Anorith base con Anorith δ Delta Species', () => {
    const { packages } = buildBatchConsolidatedPackages(withHomolog({
      bundles: [
        {
          batchId: 'batch-1',
          purchaseDate: '2026-06-05',
          items: [
            {
              batch_item_id: 'a',
              card_id: 'ex16-26',
              card_name: 'Anorith',
              language: 'en',
              quantity_ordered: 1,
              remaining_quantity: 1,
              unit_cost_cop: 1800,
              eur_unit_price: 0.45,
            },
          ],
        },
      ],
      ct0Items: [],
      orderPackages: buildOrderTransitPackages([
        {
          id: 99,
          code: 'ORD-1',
          state: 'sent',
          order_as: 'buyer',
          size: 1,
          paid_at: '2026-06-05T01:42:06.000Z',
          order_items: [
            {
              id: 100,
              product_id: 1,
              blueprint_id: 20,
              category_id: 1,
              game_id: 5,
              name: 'Anorith δ Delta Species',
              expansion: 'EX Holon Phantoms',
              quantity: 1,
              buyer_price: { cents: 25, currency: 'USD' },
              properties: { pokemon_language: 'en', collector_number: '57' },
            },
          ],
        },
      ]),
    }));

    expect(packages[0].lines[0].orderUnits).toBe(0);
    expect(packages[0].lines[0].panelOnlyUnits).toBe(1);
  });
});
