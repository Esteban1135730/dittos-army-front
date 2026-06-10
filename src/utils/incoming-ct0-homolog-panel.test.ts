import { describe, expect, it } from 'vitest';
import {
  buildPanelOnlyLines,
  homologateIncomingItems,
  type IncomingHomologStatus,
} from './incoming-ct0-homolog';

describe('buildPanelOnlyLines', () => {
  it('incluye cartas solo panel con precio y cantidad del sistema', () => {
    const homolog = new Map<string, IncomingHomologStatus>([
      [
        'item-1',
        {
          batchItemId: 'item-1',
          inCt0: false,
          ct0MatchedQty: 0,
          incomingRemainingQty: 2,
          missingFromCt0Qty: 2,
          onlyInIncoming: true,
          matchMethod: 'none',
        },
      ],
    ]);

    const lines = buildPanelOnlyLines(
      [
        {
          batchId: 'batch-a',
          items: [
            {
              batch_item_id: 'item-1',
              card_id: 'sv1-1',
              card_name: 'Pikachu',
              language: 'en',
              quantity_ordered: 2,
              remaining_quantity: 2,
              unit_cost_cop: 5000,
              image_url: 'https://example.com/p.png',
            },
          ],
        },
      ],
      homolog,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
    expect(lines[0].unitCostCop).toBe(5000);
    expect(lines[0].lineCostCop).toBe(10000);
    expect(lines[0].imageUrl).toContain('example.com');
  });
});
