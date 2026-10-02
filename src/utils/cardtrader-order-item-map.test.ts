import { describe, expect, it } from 'vitest';
import {
  CT_LANGUAGE_KEYS,
  inferOperationalRarezaFromCtProperties,
  listCtPropertyExtras,
  pickCtProperty,
  readCollectorNumber,
  readCtLanguage,
  readCtRarityLabel,
} from './cardtrader-order-item-map';

describe('cardtrader-order-item-map', () => {
  it('lee idioma pokemon_language', () => {
    expect(readCtLanguage({ pokemon_language: 'en' })).toBe('en');
    expect(readCtLanguage({ pokemon_language: 'JP' })).toBe('ja');
  });

  it('lee idioma yugioh_language', () => {
    expect(readCtLanguage({ yugioh_language: 'en' })).toBe('en');
    expect(readCtLanguage({ yugioh_language: 'ES' })).toBe('es');
  });

  it('lee idioma y rareza de Magic y One Piece', () => {
    expect(readCtLanguage({ mtg_language: 'it' })).toBe('it');
    expect(readCtLanguage({ onepiece_language: 'JP' })).toBe('ja');
    expect(readCtRarityLabel({ onepiece_rarity: 'Super Rare' })).toBe('Super Rare');
    expect(readCtRarityLabel({ mtg_rarity: 'Mythic' })).toBe('Mythic');
    expect(listCtPropertyExtras({ onepiece_language: 'en', onepiece_rarity: 'SR' })).toEqual([]);
  });

  it('pickCtProperty ignora vacíos y recorta', () => {
    expect(pickCtProperty({ pokemon_language: ' ', language: ' en ' }, CT_LANGUAGE_KEYS)).toBe(
      'en',
    );
    expect(pickCtProperty(undefined, CT_LANGUAGE_KEYS)).toBeNull();
  });

  it('infiere rareza operativa', () => {
    expect(inferOperationalRarezaFromCtProperties({ first_edition: true })).toBe('first edition');
    expect(inferOperationalRarezaFromCtProperties({ poke_ball_reverse_holo: true })).toBe(
      'pokeball',
    );
    expect(inferOperationalRarezaFromCtProperties({ reverse_holo: true })).toBe('foil');
    expect(inferOperationalRarezaFromCtProperties({})).toBeNull();
  });

  it('lee collector_number', () => {
    expect(readCollectorNumber({ collector_number: '004' })).toBe('004');
  });
});
