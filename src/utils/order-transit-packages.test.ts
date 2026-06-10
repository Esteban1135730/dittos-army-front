import { describe, expect, it } from 'vitest';
import type { CtOrder } from './cardtrader-order-pricing';
import { buildCt0HomologIndex } from './incoming-ct0-homolog';
import type { Ct0BoxItem } from './cardtrader-ct0-box';
import {
  buildOrderTransitPackages,
  filterInTransitOrders,
  filterOrderPackagesExcludingCt0,
} from './order-transit-packages';

describe('order-transit-packages', () => {
  it('filtra paid y sent; excluye done', () => {
    const orders: CtOrder[] = [
      { id: 1, code: 'a', state: 'paid', order_as: 'buyer', size: 1 },
      { id: 2, code: 'b', state: 'sent', order_as: 'buyer', size: 1 },
      { id: 3, code: 'c', state: 'done', order_as: 'buyer', size: 1 },
      { id: 4, code: 'd', state: 'arrived', order_as: 'buyer', size: 1 },
    ];
    expect(filterInTransitOrders(orders)).toHaveLength(2);
    expect(filterInTransitOrders(orders).map((o) => o.state)).toEqual(['paid', 'sent']);
  });

  it('agrupa líneas por pedido con precio', () => {
    const packages = buildOrderTransitPackages([
      {
        id: 10,
        code: 'CT-1',
        state: 'sent',
        order_as: 'buyer',
        size: 2,
        paid_at: '2026-05-29T12:00:00.000Z',
        order_items: [
          {
            id: 100,
            product_id: 1,
            blueprint_id: 5,
            category_id: 1,
            game_id: 5,
            name: 'Charizard',
            expansion: 'Base',
            quantity: 1,
            buyer_price: { cents: 500, currency: 'EUR' },
          },
        ],
      },
    ]);
    expect(packages).toHaveLength(1);
    expect(packages[0].lines[0].unitPriceEur).toBe(5);
  });

  it('excluye líneas ya cubiertas en CT Zero', () => {
    const ct0Item = (partial: Partial<Ct0BoxItem> & Pick<Ct0BoxItem, 'id'>): Ct0BoxItem => ({
      id: partial.id,
      quantity: partial.quantity ?? { pending: 1 },
      product_id: 1,
      blueprint_id: 1,
      category_id: 1,
      game_id: 5,
      name: partial.name ?? 'Pikachu',
      expansion: 'Set',
      buyer_price: { cents: 100, currency: 'USD' },
      properties: { pokemon_language: 'en' },
      ...partial,
    });

    const index = buildCt0HomologIndex({
      ct0Items: [ct0Item({ id: 1, name: 'Pikachu', quantity: { pending: 1 } })],
      readLanguage: () => 'en',
      readRareza: () => null,
    });

    const packages = buildOrderTransitPackages([
      {
        id: 1,
        code: 'x',
        state: 'paid',
        order_as: 'buyer',
        size: 1,
        order_items: [
          {
            id: 10,
            product_id: 1,
            blueprint_id: 1,
            category_id: 1,
            game_id: 5,
            name: 'Pikachu',
            expansion: 'Set',
            quantity: 1,
            properties: { pokemon_language: 'en' },
          },
          {
            id: 11,
            product_id: 2,
            blueprint_id: 2,
            category_id: 1,
            game_id: 5,
            name: 'Mewtwo',
            expansion: 'Set',
            quantity: 1,
            properties: { pokemon_language: 'en' },
          },
        ],
      },
    ]);

    const filtered = filterOrderPackagesExcludingCt0(packages, index);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].lines).toHaveLength(1);
    expect(filtered[0].lines[0].name).toBe('Mewtwo');
  });
});
