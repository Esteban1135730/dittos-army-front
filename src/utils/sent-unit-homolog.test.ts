import { describe, expect, it } from 'vitest';
import {
  rankPanelCandidates,
  scoreWordOverlap,
  tokenizeCardName,
  buildCreateTandaCardsPayload,
  resolveNovedadUnitCostCop,
} from './sent-unit-homolog';

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
        {
          batch_item_id: 'bi1',
          batch_id: 'b1',
          card_id: 'sv1-1',
          card_name: 'Pikachu',
          image_url: '',
          language: 'EN',
          rareza: null,
          remaining_quantity: 2,
          quantity_ordered: 2,
          eur_unit_price: 1.5,
          eur_total_lot: 3,
          unit_cost_cop: 7500,
          cards_cost_currency: 'EUR',
          batch_purchase_date: '2026-01-15',
          batch_total_eur_cards_cost: 30,
          batch_total_cop_cards_cost: 150000,
          real_euro_rate_cop_per_eur: 5000,
          assigned_in_session: 0,
          available_in_session: 2,
        },
        {
          batch_item_id: 'bi2',
          batch_id: 'b1',
          card_id: 'sv1-2',
          card_name: 'Raichu',
          image_url: '',
          language: 'EN',
          rareza: null,
          remaining_quantity: 1,
          quantity_ordered: 1,
          eur_unit_price: 2,
          eur_total_lot: 2,
          unit_cost_cop: 10000,
          cards_cost_currency: 'EUR',
          batch_purchase_date: '2026-01-15',
          batch_total_eur_cards_cost: 30,
          batch_total_cop_cards_cost: 150000,
          real_euro_rate_cop_per_eur: 5000,
          assigned_in_session: 0,
          available_in_session: 1,
        },
    ];

    const ranked = rankPanelCandidates({
      sentUnit: {
        name: 'Pikachu',
        expansion: 'Scarlet & Violet',
        language: 'EN',
        unit_price_eur: 1.5,
        rareza: null,
      },
      panelItems,
      expansionHomolog: {},
    });

    expect(ranked[0]?.batchItemId).toBe('bi1');
    expect(ranked[0]?.matchTier).toBe('best');
  });

  it('rankPanelCandidates matchea precios USD de CardTrader', () => {
    const panelItems = [
      {
        batch_item_id: 'bi1',
        batch_id: 'b1',
        card_id: 'sv1-1',
        card_name: 'Pikachu',
        image_url: '',
        language: 'EN',
        rareza: null,
        remaining_quantity: 2,
        quantity_ordered: 2,
        eur_unit_price: 1.5,
        eur_total_lot: 3,
        unit_cost_cop: 7500,
        cards_cost_currency: 'USD',
        batch_purchase_date: '2026-01-15',
        batch_total_eur_cards_cost: 30,
        batch_total_cop_cards_cost: 150000,
        real_euro_rate_cop_per_eur: 5000,
        assigned_in_session: 0,
        available_in_session: 2,
      },
    ];

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

    expect(ranked[0]?.batchItemId).toBe('bi1');
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
          batch_item_id: 'bi1',
          batch_id: 'b1',
          batch_item_card_id: 'sv1-1',
          batch_item_card_name: 'Pikachu',
          unit_cost_cop: 6000,
          purchase_price_eur: 1.2,
          purchase_price_fx: 1.2,
          purchase_price_currency: 'EUR',
          match_score: 0,
          novedad_notes: '',
        },
      ],
      [
        {
          batch_item_id: 'bi1',
          batch_id: 'b1',
          card_id: 'sv1-1',
          card_name: 'Pikachu',
          image_url: '',
          language: 'EN',
          rareza: null,
          remaining_quantity: 1,
          quantity_ordered: 1,
          eur_unit_price: 1.5,
          eur_total_lot: 3,
          unit_cost_cop: 7500,
          cards_cost_currency: 'EUR',
          batch_purchase_date: null,
          batch_total_eur_cards_cost: null,
          batch_total_cop_cards_cost: null,
          real_euro_rate_cop_per_eur: 5000,
          assigned_in_session: 1,
          available_in_session: 0,
        },
      ],
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
