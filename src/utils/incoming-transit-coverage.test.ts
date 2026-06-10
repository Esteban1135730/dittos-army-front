import { describe, expect, it } from 'vitest';
import {
  buildPaidSentMatchIndex,
  buildStockMatchIndex,
  computeTransitCoverage,
  resolveTransitCoverageColor,
} from './incoming-transit-coverage';

describe('incoming-transit-coverage', () => {
  it('aplica la leyenda de colores', () => {
    expect(resolveTransitCoverageColor({ inPanel: true, inPaidSent: false, inStock: true })).toBe('none');
    expect(resolveTransitCoverageColor({ inPanel: true, inPaidSent: false, inStock: false })).toBe('yellow');
    expect(resolveTransitCoverageColor({ inPanel: true, inPaidSent: true, inStock: false })).toBe('blue');
    expect(resolveTransitCoverageColor({ inPanel: false, inPaidSent: true, inStock: false })).toBe('orange');
  });

  it('detecta panel, pagado/enviado y stock por nombre', () => {
    const paidSentIndex = buildPaidSentMatchIndex([
      { name: 'Pikachu', language: 'en', qty: 1 },
    ]);
    const stockIndex = buildStockMatchIndex([
      {
        card_id: 'base1-58',
        card_name: 'Pikachu',
        language: 'en',
        cards_in_shipmet: 2,
      },
    ]);

    const blue = computeTransitCoverage({
      desc: { name: 'Pikachu', language: 'en' },
      batchItems: [
        {
          batch_item_id: 'a',
          card_id: 'base1-58',
          card_name: 'Pikachu',
          language: 'en',
          quantity_ordered: 1,
          remaining_quantity: 1,
        },
      ],
      paidSentIndex,
      stockIndex,
    });
    expect(blue.color).toBe('none');

    const yellow = computeTransitCoverage({
      desc: { name: 'Mewtwo', language: 'en' },
      batchItems: [
        {
          batch_item_id: 'b',
          card_id: 'x',
          card_name: 'Mewtwo',
          language: 'en',
          quantity_ordered: 1,
          remaining_quantity: 1,
        },
      ],
      paidSentIndex,
      stockIndex,
    });
    expect(yellow.color).toBe('yellow');

    const orange = computeTransitCoverage({
      desc: { name: 'Pikachu', language: 'en' },
      paidSentIndex,
      stockIndex,
    });
    expect(orange.color).toBe('orange');
  });
});
