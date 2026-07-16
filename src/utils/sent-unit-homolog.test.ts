import { describe, expect, it } from 'vitest';
import type { PanelHomologItem } from './sent-unit-homolog';
import {
  rankPanelCandidates,
  scoreWordOverlap,
  tokenizeCardName,
  buildCreateTandaCardsPayload,
  resolveNovedadUnitCostCop,
} from './sent-unit-homolog';

function panelItem(partial: Partial<PanelHomologItem> & Pick<PanelHomologItem, 'transit_line_id'>): PanelHomologItem {
  return {
    transit_lot_id: 'lot1',
    card_id: 'sv1-1',
    card_name: 'Pikachu',
    image_url: '',
    language: 'EN',
    rareza: null,
    remaining_quantity: 2,
    quantity_ordered: 2,
    fx_unit_price: 1.5,
    fx_total_lot: 3,
    unit_cost_cop: 7500,
    cards_cost_currency: 'EUR',
    lot_purchase_date: '2026-01-15',
    lot_total_fx_cards_cost: 30,
    lot_total_cop_cards_cost: 150000,
    real_fx_rate_cop: 5000,
    assigned_in_session: 0,
    available_in_session: 2,
    ...partial,
  };
}

describe('sent-unit-homolog', () => {
  it('tokeniza nombres ignorando stopwords', () => {
    expect(tokenizeCardName('Anorith δ Delta Species')).toContain('anorith');
    expect(tokenizeCardName('Anorith δ Delta Species')).not.toContain('delta');
  });

  it('scoreWordOverlap encuentra palabras compartidas', () => {
    const r = scoreWordOverlap('Anorith δ', 'Anorith δ Delta Species');
    expect(r.matchedWords).toContain('anorith');
    expect(r.score).toBeGreaterThan(0);
  });

  it('rankPanelCandidates prioriza match estructural', () => {
    const panelItems = [
        panelItem({ transit_line_id: 'tl1', card_name: 'Pikachu' }),
        panelItem({
          transit_line_id: 'tl2',
          card_id: 'sv1-2',
          card_name: 'Raichu',
          fx_unit_price: 2,
          fx_total_lot: 2,
          unit_cost_cop: 10000,
          remaining_quantity: 1,
          quantity_ordered: 1,
          available_in_session: 1,
        }),
    ];

    const ranked = rankPanelCandidates({
      sentUnit: {
        name: 'Pikachu',
        expansion: 'Scarlet & Violet',
        language: 'EN',
        unit_price_eur: 1.5,
        unit_price_fx: 1.5,
        rareza: null,
      },
      panelItems,
      expansionHomolog: {},
    });

    expect(ranked[0]?.transitLineId).toBe('tl1');
    expect(ranked[0]?.matchTier).toBe('best');
  });

  it('rankPanelCandidates prioriza blueprint_id exacto', () => {
    const panelItems = [
      panelItem({
        transit_line_id: 'tl-name',
        card_name: 'Pikachu',
        blueprint_id: 999,
        fx_unit_price: 1.5,
      }),
      panelItem({
        transit_line_id: 'tl-bp',
        card_name: 'Otro nombre',
        blueprint_id: 42,
        fx_unit_price: 9,
        available_in_session: 1,
        remaining_quantity: 1,
      }),
    ];

    const ranked = rankPanelCandidates({
      sentUnit: {
        name: 'Pikachu',
        expansion: 'Scarlet & Violet',
        language: 'EN',
        unit_price_eur: 1.5,
        unit_price_fx: 1.5,
        rareza: null,
        blueprint_id: 42,
      },
      panelItems,
      expansionHomolog: {},
    });

    expect(ranked[0]?.transitLineId).toBe('tl-bp');
    expect(ranked[0]?.matchTier).toBe('exact');
    expect(ranked[0]?.blueprintMatch).toBe(true);
  });

  it('rankPanelCandidates prioriza product_id sobre blueprint', () => {
    const panelItems = [
      panelItem({
        transit_line_id: 'tl-bp',
        card_name: 'Pikachu',
        blueprint_id: 42,
        product_id: 100,
        fx_unit_price: 1.5,
      }),
      panelItem({
        transit_line_id: 'tl-product',
        card_name: 'Cualquiera',
        blueprint_id: 99,
        product_id: 777,
        fx_unit_price: 9,
        available_in_session: 1,
        remaining_quantity: 1,
      }),
    ];

    const ranked = rankPanelCandidates({
      sentUnit: {
        name: 'Pikachu',
        expansion: 'Scarlet & Violet',
        language: 'EN',
        unit_price_eur: 1.5,
        unit_price_fx: 1.5,
        rareza: null,
        blueprint_id: 42,
        product_id: 777,
      },
      panelItems,
      expansionHomolog: {},
    });

    expect(ranked[0]?.transitLineId).toBe('tl-product');
    expect(ranked[0]?.matchTier).toBe('product');
    expect(ranked[0]?.productMatch).toBe(true);
  });

  it('rankPanelCandidates dentro de blueprint prioriza precio exacto', () => {
    const panelItems = [
      panelItem({
        transit_line_id: 'tl-far',
        card_name: 'Pikachu',
        blueprint_id: 42,
        fx_unit_price: 2.5,
        cards_cost_currency: 'EUR',
        available_in_session: 1,
        remaining_quantity: 1,
      }),
      panelItem({
        transit_line_id: 'tl-exact',
        card_name: 'Pikachu',
        blueprint_id: 42,
        fx_unit_price: 1.5,
        cards_cost_currency: 'EUR',
        available_in_session: 1,
        remaining_quantity: 1,
      }),
    ];

    const ranked = rankPanelCandidates({
      sentUnit: {
        name: 'Pikachu',
        expansion: 'Scarlet & Violet',
        language: 'EN',
        unit_price_eur: 1.5,
        unit_price_fx: 1.5,
        price_currency: 'EUR',
        rareza: null,
        blueprint_id: 42,
      },
      panelItems,
      expansionHomolog: {},
    });

    expect(ranked[0]?.transitLineId).toBe('tl-exact');
    expect(ranked[0]?.matchTier).toBe('exact');
    expect(ranked[0]?.priceDelta).toBe(0);
  });

  it('rankPanelCandidates matchea precios USD de CardTrader', () => {
    const panelItems = [panelItem({ transit_line_id: 'tl1', cards_cost_currency: 'USD' })];

    const ranked = rankPanelCandidates({
      sentUnit: {
        name: 'Pikachu',
        expansion: 'Scarlet & Violet',
        language: 'EN',
        unit_price_eur: null,
        unit_price_fx: 1.5,
        price_currency: 'USD',
        rareza: null,
      },
      panelItems,
      expansionHomolog: {},
    });

    expect(ranked[0]?.transitLineId).toBe('tl1');
    expect(ranked[0]?.matchTier).toBe('best');
  });

  it('buildCreateTandaCardsPayload usa precio real EUR', () => {
    const cards = buildCreateTandaCardsPayload(
      [
        {
          sent_unit_key: 'k1',
          line_key: 'l1',
          unit_index: 0,
          order_id: 1,
          order_code: 'A',
          name: 'Pikachu',
          expansion: '',
          language: 'EN',
          blueprint_id: 1,
          unit_price_eur: 1.2,
          unit_price_fx: 1.2,
          price_currency: 'EUR',
          paid_at: null,
          rareza: null,
          status: 'verified',
          transit_line_id: 'tl1',
          transit_lot_id: 'lot1',
          transit_line_card_id: 'sv1-1',
          transit_line_card_name: 'Pikachu',
          batch_item_id: null,
          batch_id: null,
          batch_item_card_id: null,
          batch_item_card_name: null,
          unit_cost_cop: 6000,
          purchase_price_eur: 1.2,
          purchase_price_fx: 1.2,
          purchase_price_currency: 'EUR',
          match_score: 0,
          novedad_notes: '',
        },
      ],
      [panelItem({ transit_line_id: 'tl1', assigned_in_session: 1, available_in_session: 0 })],
    );

    expect(cards[0].purchase_price_eur).toBe(1.2);
    expect(cards[0].unit_cost_cop).toBe(6000);
  });

  it('resolveNovedadUnitCostCop usa TRM del sistema según moneda', () => {
    const unit = {
      status: 'novedad' as const,
      unit_cost_cop: null,
      unit_price_fx: 2,
      unit_price_eur: null,
      purchase_price_fx: null,
      purchase_price_eur: null,
      price_currency: 'USD',
      purchase_price_currency: null,
    };
    expect(
      resolveNovedadUnitCostCop(unit, { euroToCop: 5000, usdToCop: 4000 }),
    ).toBe(8000);
    expect(
      resolveNovedadUnitCostCop(
        { ...unit, price_currency: 'EUR', unit_price_fx: 1.5 },
        { euroToCop: 5000, usdToCop: 4000 },
      ),
    ).toBe(7500);
  });

  it('buildCreateTandaCardsPayload usa $1 COP si la novedad no tiene precio', () => {
    const cards = buildCreateTandaCardsPayload(
      [
        {
          sent_unit_key: 'k2',
          line_key: 'l2',
          unit_index: 0,
          order_id: 2,
          order_code: 'B',
          name: 'Sin precio',
          expansion: '',
          language: 'EN',
          blueprint_id: 2,
          unit_price_eur: null,
          unit_price_fx: null,
          price_currency: 'USD',
          paid_at: null,
          rareza: null,
          status: 'novedad',
          batch_item_id: null,
          batch_id: null,
          batch_item_card_id: null,
          batch_item_card_name: null,
          transit_line_id: null,
          transit_lot_id: null,
          transit_line_card_id: null,
          transit_line_card_name: null,
          unit_cost_cop: null,
          purchase_price_eur: null,
          purchase_price_fx: null,
          purchase_price_currency: null,
          match_score: null,
          novedad_notes: 'sin TRM',
        },
      ],
      [],
      { euroToCop: null, usdToCop: null },
    );

    expect(cards[0].unit_cost_cop).toBe(1);
  });

  it('buildCreateTandaCardsPayload asigna COP a novedades con TRM del sistema', () => {
    const cards = buildCreateTandaCardsPayload(
      [
        {
          sent_unit_key: 'k1',
          line_key: 'l1',
          unit_index: 0,
          order_id: 1,
          order_code: 'A',
          name: 'Charizard',
          expansion: '',
          language: 'EN',
          blueprint_id: 1,
          unit_price_eur: null,
          unit_price_fx: 3,
          price_currency: 'USD',
          paid_at: null,
          rareza: null,
          status: 'novedad',
          batch_item_id: null,
          batch_id: null,
          batch_item_card_id: null,
          batch_item_card_name: null,
          transit_line_id: null,
          transit_lot_id: null,
          transit_line_card_id: null,
          transit_line_card_name: null,
          unit_cost_cop: null,
          purchase_price_eur: null,
          purchase_price_fx: null,
          purchase_price_currency: null,
          match_score: null,
          novedad_notes: 'carta extra',
        },
      ],
      [],
      { euroToCop: 5000, usdToCop: 4200 },
    );

    expect(cards[0].is_novedad).toBe(true);
    expect(cards[0].unit_cost_cop).toBe(12600);
    expect(cards[0].purchase_price_eur).toBe(3);
  });
});
