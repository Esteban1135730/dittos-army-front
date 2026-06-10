import { describe, expect, it } from 'vitest';
import type { PurchasePackage } from './purchase-package-consolidated';
import {
  buildConsolidatedTransitLots,
  computeLotRealCop,
  filterConsolidatedTransitLots,
} from './consolidated-transit-lots';

const pkg = (partial: Partial<PurchasePackage> & Pick<PurchasePackage, 'packageKey'>): PurchasePackage => ({
  packageKey: partial.packageKey,
  paidAt: partial.paidAt ?? partial.packageKey,
  paidAtLabel: partial.paidAtLabel ?? partial.packageKey,
  ctSubtotalUsd: partial.ctSubtotalUsd ?? 1,
  units: partial.units ?? 1,
  lineCount: partial.lineCount ?? 1,
  locations: partial.locations ?? ['ct0-hub'],
  lines: partial.lines ?? [],
});

describe('consolidated-transit-lots', () => {
  it('agrupa CT emparejado y amarillo del mismo batch en un lote', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const packages = [
      pkg({
        packageKey: paidAt,
        paidAt,
        lines: [
          {
            lineKey: 'a',
            location: 'ct0-hub',
            name: 'Pikachu',
            qty: 1,
            language: 'en',
            condition: 'NM',
            variantLabel: '—',
            referencePrice: '$1',
            referenceUsd: 1,
            unitCostCop: 10000,
            lineCostCop: 10000,
            expansion: 'Set',
            ct0ItemId: 1,
            blueprintId: 1,
          },
        ],
      }),
    ];

    const lots = buildConsolidatedTransitLots({
      packages,
      bundles: [{ batchId: 'batch-1', purchaseDate: '2026-05-28', totalCopCardsCost: 25000 }],
      panelOnlyLinesAll: [
        {
          batchItemId: 'x',
          batchId: 'batch-1',
          cardId: 'sv1-2',
          cardName: 'Raichu',
          language: 'en',
          rareza: null,
          qty: 1,
          unitCostCop: 15000,
          lineCostCop: 15000,
          eurUnitPrice: null,
          imageUrl: '',
        },
      ],
      allMatches: [
        {
          ct0PackageKey: paidAt,
          ct0PaidAt: paidAt,
          batchId: 'batch-1',
          batchPurchaseDate: '2026-05-28',
          score: 0.9,
          nameOverlapRatio: 0.8,
          matchedUnits: 1,
          ctUnits: 1,
          dateDiffDays: 1,
          matchedUniqueNames: 1,
          ctUniqueNames: 1,
          isSamePackage: true,
        },
      ],
    });

    expect(lots).toHaveLength(1);
    expect(lots[0].kind).toBe('batch');
    expect(lots[0].ctPackages).toHaveLength(1);
    expect(lots[0].panelOnlyLines).toHaveLength(1);
    expect(lots[0].realCopTotal).toBe(25000);
  });

  it('suma COP real de CT y panel', () => {
    const cop = computeLotRealCop(
      [
        pkg({
          packageKey: 'a',
          lines: [
            {
              lineKey: '1',
              location: 'ct0-hub',
              name: 'A',
              qty: 2,
              language: 'en',
              condition: 'NM',
              variantLabel: '—',
              referencePrice: '$1',
              referenceUsd: 1,
              unitCostCop: 5000,
              lineCostCop: 10000,
              expansion: '',
              ct0ItemId: 1,
              blueprintId: 1,
            },
          ],
        }),
      ],
      [
        {
          batchItemId: 'b',
          batchId: 'batch-1',
          cardId: 'x',
          cardName: 'B',
          language: 'en',
          rareza: null,
          qty: 1,
          unitCostCop: 3000,
          lineCostCop: 3000,
          eurUnitPrice: null,
          imageUrl: '',
        },
      ],
    );
    expect(cop).toBe(13000);
  });

  it('filtra lotes y líneas por búsqueda de carta', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const lots = buildConsolidatedTransitLots({
      packages: [
        pkg({
          packageKey: paidAt,
          paidAt,
          lines: [
            {
              lineKey: 'a',
              location: 'ct0-hub',
              name: 'Pikachu',
              qty: 1,
              language: 'en',
              condition: 'NM',
              variantLabel: '—',
              referencePrice: '$1',
              referenceUsd: 1,
              unitCostCop: 1000,
              lineCostCop: 1000,
              expansion: 'Base',
              ct0ItemId: 1,
              blueprintId: 1,
            },
            {
              lineKey: 'b',
              location: 'ct0-hub',
              name: 'Charizard',
              qty: 1,
              language: 'en',
              condition: 'NM',
              variantLabel: '—',
              referencePrice: '$2',
              referenceUsd: 2,
              unitCostCop: 2000,
              lineCostCop: 2000,
              expansion: 'Base',
              ct0ItemId: 2,
              blueprintId: 2,
            },
          ],
        }),
      ],
      bundles: [{ batchId: 'batch-1', purchaseDate: '2026-05-28' }],
      panelOnlyLinesAll: [
        {
          batchItemId: 'x',
          batchId: 'batch-1',
          cardId: 'sv1-2',
          cardName: 'Mewtwo',
          language: 'en',
          rareza: null,
          qty: 1,
          unitCostCop: 5000,
          lineCostCop: 5000,
          eurUnitPrice: null,
          imageUrl: '',
        },
      ],
      allMatches: [
        {
          ct0PackageKey: paidAt,
          ct0PaidAt: paidAt,
          batchId: 'batch-1',
          batchPurchaseDate: '2026-05-28',
          score: 0.9,
          nameOverlapRatio: 0.8,
          matchedUnits: 2,
          ctUnits: 2,
          dateDiffDays: 1,
          matchedUniqueNames: 2,
          ctUniqueNames: 2,
          isSamePackage: true,
        },
      ],
    });

    const filtered = filterConsolidatedTransitLots(lots, 'char');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].ctPackages[0].lines).toHaveLength(1);
    expect(filtered[0].ctPackages[0].lines[0].name).toBe('Charizard');
    expect(filtered[0].panelOnlyLines).toHaveLength(0);

    const filteredPanel = filterConsolidatedTransitLots(lots, 'mew');
    expect(filteredPanel[0].ctPackages).toHaveLength(0);
    expect(filteredPanel[0].panelOnlyLines).toHaveLength(1);
  });
});
