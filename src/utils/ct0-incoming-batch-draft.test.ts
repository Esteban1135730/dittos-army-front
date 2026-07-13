import { describe, expect, it, vi } from 'vitest';
import type { Ct0BoxItem } from './cardtrader-ct0-box';
import {
  buildCt0IncomingBatchDrafts,
  buildInitialCopByPackageKey,
  buildTransitLotPayloadFromDraft,
  purchaseDateFromPaidAt,
  resolveCt0BatchDraftTcgdex,
  suggestedCopForDraft,
} from './ct0-incoming-batch-draft';
import { dayDiffBetweenDatesFlexible } from './incoming-ct0-package-match';

const ct0Item = (partial: Partial<Ct0BoxItem> & Pick<Ct0BoxItem, 'id'>): Ct0BoxItem => ({
  id: partial.id,
  quantity: partial.quantity ?? { pending: 1 },
  product_id: 1,
  blueprint_id: partial.blueprint_id ?? 100,
  category_id: 1,
  game_id: 5,
  name: partial.name ?? 'Card',
  expansion: partial.expansion ?? 'Surging Sparks',
  buyer_price: partial.buyer_price ?? { cents: 100, currency: 'USD' },
  paid_at: partial.paid_at,
  properties: partial.properties,
  ...partial,
});

describe('ct0-incoming-batch-draft', () => {
  it('purchaseDateFromPaidAt devuelve YYYY-MM-DD', () => {
    expect(purchaseDateFromPaidAt('2026-05-29T15:33:34.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('marca lote como already_registered si ya existe en transit lots', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const drafts = buildCt0IncomingBatchDrafts({
      ct0Items: [
        ct0Item({
          id: 1,
          paid_at: paidAt,
          name: 'Crushing Hammer',
          quantity: { pending: 2 },
          properties: { collector_number: '136', pokemon_language: 'en' },
        }),
      ],
      existingTransitLots: [{ ct0_package_key: paidAt, lot_id: 'lot-new-1' }],
    });

    expect(drafts[0].status).toBe('already_registered');
    expect(drafts[0].transitLotId).toBe('lot-new-1');
  });

  it('usa legacy batch solo como hint de COP, no como registrado', () => {
    const paidAt = '2026-05-29T15:33:34.000Z';
    const normalizedKey = '2026-05-29T15:33:00.000Z';
    const drafts = buildCt0IncomingBatchDrafts({
      ct0Items: [
        ct0Item({
          id: 1,
          paid_at: paidAt,
          name: 'Crushing Hammer',
          quantity: { pending: 2 },
          properties: { collector_number: '136', pokemon_language: 'en' },
        }),
      ],
      legacyIncomingBundles: [
        {
          batchId: 'batch-legacy',
          purchaseDate: '2026-05-29T00:00:00.000Z',
          totalCopCardsCost: 120000,
          totalFxCardsCost: 50,
          cardsCostCurrency: 'USD',
          realFxRateCop: 2400,
          items: [
            {
              card_name: 'Crushing Hammer',
              quantity_ordered: 2,
              remaining_quantity: 2,
            },
          ],
        },
      ],
    });

    expect(drafts[0].status).toBe('ready');
    expect(drafts[0].legacyBatchId).toBe('batch-legacy');
    expect(drafts[0].legacyCopHint).toBe(120000);
    expect(drafts[0].legacyCopAutoFilled).toBe(true);
    expect(drafts[0].legacyTotalFxCardsCost).toBe(50);
    expect(drafts[0].legacyRealFxRateCop).toBe(2400);
    expect(suggestedCopForDraft(drafts[0], {})).toBe(120000);
    expect(buildInitialCopByPackageKey(drafts)[normalizedKey]).toBe('120000');
  });

  it('toma COP legacy por fecha e ítems aunque falle el match de paquete', () => {
    const paidAt = '2026-06-01T12:00:00.000Z';
    const drafts = buildCt0IncomingBatchDrafts({
      ct0Items: [
        ct0Item({
          id: 10,
          paid_at: paidAt,
          name: 'Matched Card',
          quantity: { pending: 2 },
          properties: { pokemon_language: 'en' },
        }),
        ct0Item({
          id: 11,
          paid_at: paidAt,
          name: 'Only In CT',
          quantity: { pending: 2 },
          properties: { pokemon_language: 'en' },
        }),
      ],
      legacyIncomingBundles: [
        {
          batchId: 'batch-partial',
          purchaseDate: '2026-06-01T00:00:00.000Z',
          totalCopCardsCost: 250000,
          totalFxCardsCost: 100,
          cardsCostCurrency: 'USD',
          realFxRateCop: 2500,
          items: [
            {
              card_name: 'Matched Card',
              quantity_ordered: 2,
              remaining_quantity: 2,
            },
          ],
        },
      ],
    });

    expect(drafts[0].legacyBatchId).toBe('batch-partial');
    expect(drafts[0].legacyCopHint).toBe(250000);
    expect(drafts[0].legacyCopAutoFilled).toBe(true);
  });

  it('empareja legacy con nombres equivalentes (variante δ)', () => {
    const paidAt = '2026-04-09T18:00:00.000Z';
    const drafts = buildCt0IncomingBatchDrafts({
      ct0Items: [
        ct0Item({
          id: 30,
          paid_at: paidAt,
          name: 'Anorith δ',
          quantity: { pending: 1 },
          properties: { pokemon_language: 'en' },
        }),
      ],
      legacyIncomingBundles: [
        {
          batchId: 'batch-apr-9',
          purchaseDate: '2026-04-09',
          totalCopCardsCost: 150000,
          totalFxCardsCost: 60,
          cardsCostCurrency: 'USD',
          realFxRateCop: 2500,
          items: [
            {
              card_name: 'Anorith δ Delta Species',
              quantity_ordered: 1,
              remaining_quantity: 1,
            },
          ],
        },
        {
          batchId: 'batch-wrong',
          purchaseDate: '2026-04-09',
          totalCopCardsCost: 999999,
          totalFxCardsCost: 400,
          cardsCostCurrency: 'USD',
          realFxRateCop: 2500,
          items: [
            {
              card_name: 'Otra carta',
              quantity_ordered: 1,
              remaining_quantity: 1,
            },
          ],
        },
      ],
    });

    expect(drafts[0].legacyBatchId).toBe('batch-apr-9');
    expect(drafts[0].legacyCopHint).toBe(150000);
  });

  it('marca homolog_error si falta homologación TCGdex', async () => {
    const paidAt = '2026-05-30T10:00:00.000Z';
    const drafts = buildCt0IncomingBatchDrafts({
      ct0Items: [
        ct0Item({
          id: 2,
          paid_at: paidAt,
          name: 'Switch',
          expansion: 'Unknown Set XYZ',
          quantity: { pending: 1 },
          properties: { pokemon_language: 'en' },
        }),
      ],
    });

    const resolved = await resolveCt0BatchDraftTcgdex(drafts, async () => ({
      tcgdex_card_id: null,
      tcgdex_set_id: null,
      locale: null,
      error: 'expansion sin homologación TCGdex',
    }));

    expect(resolved[0].status).toBe('homolog_error');
  });

  it('buildTransitLotPayloadFromDraft usa IDs TCGdex y tablas nuevas', () => {
    const draft = {
      packageKey: '2026-05-30T10:00:00.000Z',
      paidAt: '2026-05-30T10:00:00.000Z',
      paidAtLabel: 'x',
      purchaseDate: '2026-05-30',
      status: 'ready' as const,
      transitLotId: null,
      legacyBatchId: 'legacy-1',
      legacyCopHint: 90000,
      legacyCopAutoFilled: true,
      legacyTotalFxCardsCost: 30,
      legacyCardsCostCurrency: 'USD',
      legacyRealFxRateCop: 3000,
      matchScore: 0.8,
      totalUnits: 2,
      usdSubtotal: 1.5,
      unresolvedCount: 0,
      lines: [
        {
          lineKey: 'a',
          ct0ItemId: 1,
          name: 'Switch',
          expansion: 'Set',
          collectorNumber: '194',
          language: 'en',
          qty: 2,
          usdTotalLot: 1.5,
          rareza: null,
          tcgdexCardId: 'sv8-194',
          tcgdexError: null,
          blueprintId: 1,
        },
      ],
    };

    const payload = buildTransitLotPayloadFromDraft(draft, 50000);
    expect(payload.cards_cost_currency).toBe('USD');
    expect(payload.ct0_package_key).toBe(draft.packageKey);
    expect(payload.legacy_incoming_batch_id).toBe('legacy-1');
    expect(payload.legacy_basis_total_fx_cards_cost).toBe(30);
    expect(payload.legacy_basis_total_cop_cards_cost).toBe(90000);
    expect(payload.legacy_basis_real_fx_rate_cop).toBe(3000);
    expect(payload.total_cop_cards_cost).toBe(90000);
    expect(payload.items[0].card_id).toBe('sv8-194');
    expect(payload.items[0].fx_total_lot).toBe(1.5);
  });

  it('sin FX legacy no envía legacy_basis', () => {
    const draft = {
      packageKey: 'pk',
      paidAt: '2026-05-30T10:00:00.000Z',
      paidAtLabel: 'x',
      purchaseDate: '2026-05-30',
      status: 'ready' as const,
      transitLotId: null,
      legacyBatchId: null,
      legacyCopHint: null,
      legacyCopAutoFilled: false,
      legacyTotalFxCardsCost: null,
      legacyCardsCostCurrency: null,
      legacyRealFxRateCop: null,
      matchScore: null,
      totalUnits: 1,
      usdSubtotal: 1,
      unresolvedCount: 0,
      lines: [
        {
          lineKey: 'a',
          ct0ItemId: 1,
          name: 'Card',
          expansion: 'Set',
          collectorNumber: '1',
          language: 'en',
          qty: 1,
          usdTotalLot: 1,
          rareza: null,
          tcgdexCardId: 'sv8-1',
          tcgdexError: null,
          blueprintId: 1,
        },
      ],
    };

    const payload = buildTransitLotPayloadFromDraft(draft, 80000);
    expect(payload.legacy_basis_total_fx_cards_cost).toBeUndefined();
    expect(payload.total_cop_cards_cost).toBe(80000);
    expect(payload.cards_cost_currency).toBe('USD');
  });

  it('resolveCt0BatchDraftTcgdex cachea por expansión+número', async () => {
    const paidAt = '2026-05-31T10:00:00.000Z';
    const drafts = buildCt0IncomingBatchDrafts({
      ct0Items: [
        ct0Item({
          id: 3,
          paid_at: paidAt,
          name: 'Card A',
          quantity: { pending: 1 },
          properties: { collector_number: '1', pokemon_language: 'en' },
        }),
        ct0Item({
          id: 4,
          paid_at: paidAt,
          name: 'Card B',
          quantity: { pending: 1 },
          properties: { collector_number: '1', pokemon_language: 'en' },
        }),
      ],
    });

    const resolve = vi.fn(async () => ({
      tcgdex_card_id: 'sv8-1',
      tcgdex_set_id: 'sv8',
      locale: 'en',
      error: null,
    }));

    const resolved = await resolveCt0BatchDraftTcgdex(drafts, resolve);
    expect(resolved[0].status).toBe('ready');
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('aplica COP legacy con fechas desfasadas por zona horaria', () => {
    const paidAt = '2026-05-30T04:00:00.000Z';
    expect(dayDiffBetweenDatesFlexible(paidAt, '2026-05-29')).toBe(0);

    const drafts = buildCt0IncomingBatchDrafts({
      ct0Items: [
        ct0Item({
          id: 20,
          paid_at: paidAt,
          name: 'Pikachu',
          quantity: { pending: 1 },
          properties: { pokemon_language: 'en' },
        }),
      ],
      legacyIncomingBundles: [
        {
          batchId: 'batch-tz',
          purchaseDate: '2026-05-29',
          totalCopCardsCost: 88000,
          totalFxCardsCost: 44,
          cardsCostCurrency: 'USD',
          realFxRateCop: 2000,
          items: [
            {
              card_name: 'Pikachu',
              quantity_ordered: 1,
              remaining_quantity: 1,
            },
          ],
        },
      ],
    });

    expect(drafts[0].legacyCopHint).toBe(88000);
    expect(drafts[0].legacyCopAutoFilled).toBe(true);
  });
});
