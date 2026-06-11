import { describe, expect, it } from 'vitest';
import {
  buildTcgDexLocaleFallbackChain,
  mapCardTraderLangForStorage,
  parseTcgDexCardFindResponse,
  tcgDexApiLocaleForCardTrader,
} from './cardtrader-json-import';

describe('cardtrader-json-import', () => {
  it('maps CardTrader language to panel storage', () => {
    expect(mapCardTraderLangForStorage('jp')).toBe('ja');
    expect(mapCardTraderLangForStorage('kr')).toBe('ko');
    expect(mapCardTraderLangForStorage('zh-CN')).toBe('zh');
    expect(mapCardTraderLangForStorage('it')).toBe('it');
    expect(mapCardTraderLangForStorage('xx')).toBe('otro');
  });

  it('maps CardTrader language to TCGdex API locale', () => {
    expect(tcgDexApiLocaleForCardTrader('jp')).toBe('ja');
    expect(tcgDexApiLocaleForCardTrader('kr')).toBe('ja');
    expect(tcgDexApiLocaleForCardTrader('zh-CN')).toBe('zh-cn');
    expect(tcgDexApiLocaleForCardTrader('en')).toBe('en');
  });

  it('builds locale fallback chain with primary first', () => {
    expect(buildTcgDexLocaleFallbackChain('jp')).toEqual(['ja', 'zh-cn', 'en']);
    expect(buildTcgDexLocaleFallbackChain('zh-CN')).toEqual(['zh-cn', 'ja', 'en']);
    expect(buildTcgDexLocaleFallbackChain(undefined)).toEqual(['en', 'ja', 'zh-cn']);
  });

  it('parses TCGdex find response without using localized name', () => {
    const parsed = parseTcgDexCardFindResponse({
      id: 'CBB1C-01-06_09',
      name: 'ピカチュウ',
      image: 'https://example.com/card.webp',
    });
    expect(parsed).toEqual({
      id: 'CBB1C-01-06_09',
      image: 'https://example.com/card.webp',
    });
  });
});
