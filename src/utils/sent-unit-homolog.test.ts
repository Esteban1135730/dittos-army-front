import { describe, expect, it } from 'vitest';
import {
  rankPanelCandidates,
  scoreWordOverlap,
  tokenizeCardName,
  buildCreateTandaCardsPayload,
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
});
