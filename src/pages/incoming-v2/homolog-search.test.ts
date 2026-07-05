import { describe, expect, it } from 'vitest';
import {
  buildSentUnitSearchHaystack,
  filterByHomologSearch,
  matchesHomologHaystack,
  matchesHomologSearch,
} from './homolog-search';
import type { SentHomologUnit } from '../../utils/sent-unit-homolog';

const baseSentUnit: SentHomologUnit = {
  sent_unit_key: 'k1',
  line_key: 'l1',
  unit_index: 0,
  order_id: 1,
  order_code: 'ORD-1',
  name: 'Anorith δ',
  expansion: 'EX Holon Phantoms',
  language: 'EN',
  blueprint_id: 1,
  unit_price_eur: null,
  unit_price_fx: 1.5,
  price_currency: 'USD',
  paid_at: null,
  rareza: 'pokeball',
  status: 'pending',
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
  novedad_notes: '',
};

describe('homolog-search', () => {
  it('vacío muestra todo', () => {
    expect(matchesHomologSearch('', ['Pikachu'])).toBe(true);
    expect(
      filterByHomologSearch(
        [{ id: 1 }, { id: 2 }],
        () => 'pikachu',
        '',
      ),
    ).toHaveLength(2);
  });

  it('busca por varias palabras', () => {
    expect(matchesHomologSearch('anorith en', ['Anorith δ', 'EN'])).toBe(true);
    expect(matchesHomologSearch('anorith pikachu', ['Anorith δ'])).toBe(false);
  });

  it('haystack precalculado incluye precio y rareza', () => {
    const hay = buildSentUnitSearchHaystack(baseSentUnit);
    expect(matchesHomologHaystack(hay, 'anorith pokeball')).toBe(true);
    expect(matchesHomologHaystack(hay, '1.5 usd')).toBe(true);
  });

  it('filterByHomologSearch usa haystack sin reformatear', () => {
    const items = [baseSentUnit, { ...baseSentUnit, sent_unit_key: 'k2', name: 'Pikachu' }];
    const filtered = filterByHomologSearch(
      items,
      (u) => buildSentUnitSearchHaystack(u),
      'anorith pokeball',
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('Anorith δ');
  });

  it('query undefined o vacío no rompe y muestra todo', () => {
    const items = [baseSentUnit];
    expect(filterByHomologSearch(items, () => 'pikachu', undefined)).toHaveLength(1);
    expect(filterByHomologSearch(items, () => 'pikachu', null)).toHaveLength(1);
    expect(matchesHomologHaystack('pikachu', undefined)).toBe(true);
    expect(matchesHomologHaystack('pikachu', '\\')).toBe(false);
  });
});
