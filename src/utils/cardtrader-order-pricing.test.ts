import { describe, expect, it } from 'vitest';
import {
  allocateOrderCopToItems,
  orderBuyerTotalUnits,
  type CtOrder,
  type CtOrderItem,
} from './cardtrader-order-pricing';

const item = (args: Partial<CtOrderItem> & Pick<CtOrderItem, 'id'>): CtOrderItem => ({
  id: args.id,
  product_id: args.product_id ?? 1,
  blueprint_id: args.blueprint_id ?? 1,
  category_id: 1,
  game_id: 5,
  name: args.name ?? 'Pikachu',
  expansion: args.expansion ?? 'Base Set',
  quantity: args.quantity ?? 1,
  buyer_price: args.buyer_price ?? { cents: 100, currency: 'USD' },
  properties: args.properties,
});

describe('allocateOrderCopToItems', () => {
  it('reparte COP proporcional al peso buyer_price × qty', () => {
    const items = [
      item({ id: 1, quantity: 2, buyer_price: { cents: 200, currency: 'USD' } }),
      item({ id: 2, quantity: 1, buyer_price: { cents: 400, currency: 'USD' } }),
    ];
    const result = allocateOrderCopToItems(items, 100_000);
    expect(result.lines[0].lineCop).toBeCloseTo(50_000, 0);
    expect(result.lines[1].lineCop).toBeCloseTo(50_000, 0);
    expect(result.lines[0].unitCop).toBeCloseTo(25_000, 0);
    expect(result.implicitRateCopPerUnit).toBeCloseTo(12_500, 0);
  });

  it('devuelve tasas nulas si totalCop es inválido', () => {
    const result = allocateOrderCopToItems([item({ id: 1 })], 0);
    expect(result.implicitRateCopPerUnit).toBeNull();
    expect(result.lines[0].unitCop).toBe(0);
  });
});

describe('orderBuyerTotalUnits', () => {
  it('prioriza buyer_total del pedido', () => {
    const order: CtOrder = {
      id: 1,
      code: 'x',
      state: 'paid',
      order_as: 'buyer',
      size: 1,
      buyer_total: { cents: 3889, currency: 'USD' },
      order_items: [item({ id: 1, buyer_price: { cents: 100, currency: 'USD' } })],
    };
    expect(orderBuyerTotalUnits(order)).toBeCloseTo(38.89, 2);
  });
});
