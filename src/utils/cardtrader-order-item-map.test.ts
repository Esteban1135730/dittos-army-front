import { describe, expect, it } from 'vitest';
import {
  inferOperationalRarezaFromCtProperties,
  readCollectorNumber,
  readCtLanguage,
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
