import { describe, expect, it } from 'vitest';
import type { Ct0BoxItem } from './cardtrader-ct0-box';
import {
  buildCt0HomologIndex,
  computeSuggestedCopFromBatchItems,
  homologateIncomingItems,
  summarizeIncomingHomolog,
} from './incoming-ct0-homolog';

const ct0 = (partial: Partial<Ct0BoxItem> & Pick<Ct0BoxItem, 'id'>): Ct0BoxItem => ({
  id: partial.id,
  quantity: partial.quantity ?? { pending: 1 },
  product_id: 1,
  blueprint_id: 1,
  category_id: 1,
  game_id: 5,
  name: partial.name ?? 'Card',
  expansion: 'Set',
  buyer_price: partial.buyer_price ?? { cents: 100, currency: 'USD' },
  properties: partial.properties,
  ...partial,
});

describe('incoming-ct0-homolog', () => {
  it('marca amarillo lo que está en panel y no en CT0', () => {
    const index = buildCt0HomologIndex({
      ct0Items: [
        ct0({
          id: 1,
          name: 'Trapinch',
          quantity: { pending: 1 },
          properties: { pokemon_language: 'en' },
        }),
      ],
      readLanguage: (p) => String(p?.pokemon_language ?? ''),
      readRareza: () => null,
    });

    const statuses = homologateIncomingItems(
      [
        {
          batch_item_id: 'a',
          card_id: 'ex3-78',
          card_name: 'Trapinch',
          language: 'en',
          quantity_ordered: 2,
          remaining_quantity: 2,
        },
        {
          batch_item_id: 'b',
          card_id: 'ex3-99',
          card_name: 'Flygon',
          language: 'en',
          quantity_ordered: 1,
          remaining_quantity: 1,
        },
      ],
      index,
    );

    expect(statuses.get('a')?.onlyInIncoming).toBe(true);
    expect(statuses.get('a')?.missingFromCt0Qty).toBe(1);
    expect(statuses.get('b')?.onlyInIncoming).toBe(true);
    expect(statuses.get('b')?.missingFromCt0Qty).toBe(1);
  });

  it('resume unidades solo en panel', () => {
    const statuses = homologateIncomingItems(
      [
        {
          batch_item_id: 'b',
          card_id: 'x',
          card_name: 'Flygon',
          language: 'en',
          quantity_ordered: 3,
          remaining_quantity: 3,
        },
      ],
      buildCt0HomologIndex({
        ct0Items: [],
        readLanguage: () => 'en',
        readRareza: () => null,
      }),
    );

    const summary = summarizeIncomingHomolog(statuses.values(), 0);
    expect(summary.onlyIncomingLines).toBe(1);
    expect(summary.onlyIncomingUnits).toBe(3);
  });

  it('suma COP sugerido desde unit_cost_cop del lote panel', () => {
    const cop = computeSuggestedCopFromBatchItems(
      [
        { name: 'Trapinch', qty: 2, language: 'en' },
        { name: 'Unknown', qty: 1, language: 'en' },
      ],
      [
        {
          batch_item_id: 'a',
          card_id: 'ex3-78',
          card_name: 'Trapinch',
          language: 'en',
          quantity_ordered: 2,
          remaining_quantity: 2,
          unit_cost_cop: 15000,
        },
      ],
    );
    expect(cop).toBe(30000);
  });

  it('empareja CT Zero listas (ok) aunque el idioma del panel difiera', () => {
    const index = buildCt0HomologIndex({
      ct0Items: [
        ct0({
          id: 1,
          name: 'Pikachu',
          quantity: { ok: 1 },
          properties: { pokemon_language: 'en' },
        }),
      ],
      readLanguage: (p) => String(p?.pokemon_language ?? ''),
      readRareza: () => null,
    });

    const statuses = homologateIncomingItems(
      [
        {
          batch_item_id: 'a',
          card_id: 'base1-58',
          card_name: 'Pikachu',
          language: 'English',
          quantity_ordered: 1,
          remaining_quantity: 1,
        },
      ],
      index,
    );

    expect(statuses.get('a')?.onlyInIncoming).toBe(false);
    expect(statuses.get('a')?.missingFromCt0Qty).toBe(0);
  });
});
