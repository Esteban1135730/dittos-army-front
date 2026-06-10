import { describe, expect, it } from 'vitest';
import {
  buildExpansionHomologIndex,
  buildExternalTransitProfile,
  buildPanelTransitProfile,
  matchTransitCards,
  parseTcgdexCardId,
  scoreTransitCardMatch,
} from './transit-card-match';

const holonHomolog = buildExpansionHomologIndex([
  {
    tcgdxSetId: 'ex13',
    aliases: ['EX Holon Phantoms', 'Holon Phantoms'],
  },
]);

describe('transit-card-match', () => {
  it('parsea card_id TCGdex', () => {
    expect(parseTcgdexCardId('ex13-57')).toEqual({
      tcgdxSetId: 'ex13',
      tcgdxLocalId: '57',
    });
  });

  it('empareja por set + número de colección', () => {
    const panel = buildPanelTransitProfile({
      card_id: 'ex13-57',
      card_name: 'Anorith δ',
      language: 'en',
      eur_unit_price: 0.25,
    });
    const external = buildExternalTransitProfile({
      name: 'Anorith δ Delta Species',
      language: 'en',
      expansion: 'EX Holon Phantoms',
      collectorNumber: '57',
      unitPriceEur: null,
      unitPrice: 0.25,
      priceCurrency: 'USD',
      expansionHomolog: holonHomolog,
    });

    expect(matchTransitCards(panel, external, 'metadata')).toBe(true);
    expect(scoreTransitCardMatch(panel, external)).toBe(0);
  });

  it('no mezcla Anorith base con delta del mismo set', () => {
    const panel = buildPanelTransitProfile({
      card_id: 'ex16-26',
      card_name: 'Anorith',
      language: 'en',
      eur_unit_price: 0.45,
    });
    const external = buildExternalTransitProfile({
      name: 'Anorith δ Delta Species',
      language: 'en',
      expansion: 'EX Holon Phantoms',
      collectorNumber: '57',
      unitPriceEur: null,
      unitPrice: 0.25,
      priceCurrency: 'USD',
      expansionHomolog: holonHomolog,
    });

    expect(matchTransitCards(panel, external, 'metadata')).toBe(false);
  });
});
