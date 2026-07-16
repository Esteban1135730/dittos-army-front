import { describe, expect, it } from 'vitest';
import type { PurchasePackage } from './purchase-package-consolidated';
import {
  buildCt0PackageProfile,
  buildIncomingBatchProfile,
  cardNameMatchKeys,
  cardNamesMatchForTransit,
  dayDiffBetweenDatesFlexible,
  matchCt0PackagesToIncomingBatches,
  normalizeCardNameForMatch,
  scoreCt0ToIncomingBatchPair,
} from './incoming-ct0-package-match';

const pkg = (paidAt: string, lines: { name: string; qty: number }[]): PurchasePackage => ({
  packageKey: paidAt,
  paidAt,
  paidAtLabel: paidAt,
  ctSubtotalUsd: 1,
  units: lines.reduce((s, l) => s + l.qty, 0),
  lineCount: lines.length,
  locations: [],
  lines: lines.map((l, i) => ({
    lineKey: String(i),
    location: 'ct0-hub',
    name: l.name,
    qty: l.qty,
    language: 'en',
    condition: 'NM',
    variantLabel: '—',
    referencePrice: '$1',
    referenceUsd: 1,
    unitCostCop: null,
    lineCostCop: null,
    expansion: 'Set',
    ct0ItemId: i,
    productId: i,
    blueprintId: i,
  })),
});

describe('incoming-ct0-package-match', () => {
  it('normaliza nombres con variante δ', () => {
    expect(cardNameMatchKeys('Anorith δ Delta Species')).toContain('anorith δ');
    expect(cardNameMatchKeys('Anorith δ')).toContain('anorith δ');
  });

  it('normaliza apóstrofos y guiones', () => {
    expect(normalizeCardNameForMatch("Boss's Orders")).toBe('boss orders');
    expect(
      cardNamesMatchForTransit("Boss's Orders", 'Boss Orders', 'relaxed'),
    ).toBe(true);
  });

  it('empareja TCGdex acortado con CardTrader completo', () => {
    expect(cardNamesMatchForTransit('Anorith δ', 'Anorith δ Delta Species', 'strict')).toBe(true);
  });

  it('no empareja Anorith base con variante δ', () => {
    expect(cardNamesMatchForTransit('Anorith', 'Anorith δ Delta Species', 'strict')).toBe(false);
    expect(cardNamesMatchForTransit('Anorith', 'Anorith δ Delta Species', 'relaxed')).toBe(false);
  });

  it('empareja cuando nombres mayoría y fecha cercana', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-05-29T15:00:00.000Z', [
        { name: 'Crushing Hammer', qty: 4 },
        { name: 'Switch', qty: 2 },
        { name: 'Xerneas', qty: 1 },
      ]),
    );
    const batch = buildIncomingBatchProfile('batch-1', '2026-05-29', [
      { card_name: 'Crushing Hammer', quantity_ordered: 4, remaining_quantity: 4 },
      { card_name: 'Switch', quantity_ordered: 2, remaining_quantity: 2 },
      { card_name: 'Xerneas', quantity_ordered: 1, remaining_quantity: 1 },
      { card_name: 'Otra carta', quantity_ordered: 1, remaining_quantity: 1 },
    ]);

    const scored = scoreCt0ToIncomingBatchPair(ct, batch)!;
    expect(scored.nameOverlapRatio).toBe(1);
    expect(scored.dateDiffDays).toBe(0);
    expect(scored.isSamePackage).toBeUndefined();

    const matches = matchCt0PackagesToIncomingBatches([ct], [batch]);
    expect(matches).toHaveLength(1);
    expect(matches[0].batchId).toBe('batch-1');
  });

  it('no empareja si la fecha está fuera de rango', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-06-20T15:00:00.000Z', [{ name: 'Pikachu', qty: 1 }]),
    );
    const batch = buildIncomingBatchProfile('batch-1', '2026-05-01', [
      { card_name: 'Pikachu', quantity_ordered: 1, remaining_quantity: 1 },
    ]);

    expect(scoreCt0ToIncomingBatchPair(ct, batch)).toBeNull();
  });

  it('no empareja si pocos nombres coinciden', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-05-29T15:00:00.000Z', [
        { name: 'A', qty: 1 },
        { name: 'B', qty: 1 },
        { name: 'C', qty: 1 },
        { name: 'D', qty: 1 },
      ]),
    );
    const batch = buildIncomingBatchProfile('batch-1', '2026-05-29', [
      { card_name: 'A', quantity_ordered: 1, remaining_quantity: 1 },
      { card_name: 'X', quantity_ordered: 10, remaining_quantity: 10 },
    ]);

    expect(scoreCt0ToIncomingBatchPair(ct, batch)).toBeNull();
  });

  it('empareja con al menos 30% de unidades CT coincidentes', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-05-29T15:00:00.000Z', [
        { name: 'A', qty: 1 },
        { name: 'B', qty: 1 },
        { name: 'C', qty: 1 },
      ]),
    );
    const batch = buildIncomingBatchProfile('batch-1', '2026-05-29', [
      { card_name: 'A', quantity_ordered: 1, remaining_quantity: 1 },
      { card_name: 'X', quantity_ordered: 10, remaining_quantity: 10 },
    ]);

    const scored = scoreCt0ToIncomingBatchPair(ct, batch);
    expect(scored).not.toBeNull();
    expect(scored!.nameOverlapRatio).toBeGreaterThanOrEqual(0.3);
  });

  it('empareja nombres con variante δ en el score de paquete', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-04-09T18:00:00.000Z', [{ name: 'Anorith δ', qty: 1 }]),
    );
    const batch = buildIncomingBatchProfile('batch-apr', '2026-04-09', [
      { card_name: 'Anorith δ Delta Species', quantity_ordered: 1, remaining_quantity: 1 },
    ]);

    expect(scoreCt0ToIncomingBatchPair(ct, batch)).not.toBeNull();
  });

  it('empareja aunque no estén todos los nombres del pedido CT en el lote', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-04-09T18:00:00.000Z', [
        { name: 'Carta A', qty: 1 },
        { name: 'Carta B', qty: 1 },
      ]),
    );
    const batch = buildIncomingBatchProfile('batch-apr', '2026-04-09', [
      { card_name: 'Carta A', quantity_ordered: 1, remaining_quantity: 1 },
    ]);

    expect(scoreCt0ToIncomingBatchPair(ct, batch)).not.toBeNull();
  });

  it('empareja sufijo ex en modo relaxed', () => {
    expect(cardNamesMatchForTransit('Mewtwo ex', 'Mewtwo', 'relaxed')).toBe(true);
  });

  it('prefiere lote con fecha más cercana al desempatar', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-04-10T12:00:00.000Z', [{ name: 'Pikachu', qty: 1 }]),
    );
    const near = buildIncomingBatchProfile('batch-near', '2026-04-09', [
      { card_name: 'Pikachu', quantity_ordered: 1, remaining_quantity: 1 },
    ]);
    const far = buildIncomingBatchProfile('batch-far', '2026-04-01', [
      { card_name: 'Pikachu', quantity_ordered: 1, remaining_quantity: 1 },
    ]);

    const matches = matchCt0PackagesToIncomingBatches([ct], [far, near]);
    expect(matches).toHaveLength(1);
    expect(matches[0].batchId).toBe('batch-near');
  });

  it('tolera desfase horario entre checkout CT0 y fecha legacy', () => {
    const ct = buildCt0PackageProfile(
      pkg('2026-05-30T04:00:00.000Z', [{ name: 'Pikachu', qty: 1 }]),
    );
    const batch = buildIncomingBatchProfile('batch-1', '2026-05-29', [
      { card_name: 'Pikachu', quantity_ordered: 1, remaining_quantity: 1 },
    ]);

    expect(dayDiffBetweenDatesFlexible(ct.paidAt, batch.purchaseDate)).toBe(0);
    expect(scoreCt0ToIncomingBatchPair(ct, batch)).not.toBeNull();
  });
});
