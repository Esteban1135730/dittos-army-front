import axios from 'axios';

/** CardTrader language_code → TCGdex API path segment (aligned with scripts/card-trader/tcgdex_locale.py). */
export const TCGDEX_API_LOCALE_BY_LANG: Record<string, string> = {
  jp: 'ja',
  ja: 'ja',
  ko: 'ja',
  kr: 'ja',
  zh: 'zh-tw',
  cn: 'zh-tw',
  zht: 'zh-tw',
  'zh-tw': 'zh-tw',
  'zh-hant': 'zh-tw',
  'zh-cn': 'zh-cn',
  'zh-hans': 'zh-cn',
  es: 'es',
  en: 'en',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
};

const STORAGE_LANG_VALUES = new Set(['es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh']);

const BACKEND_TCGDEX_LOCALES = new Set([
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ko',
  'zh-cn',
]);

function toBackendTcgDexLocale(locale: string): string | null {
  const normalized = locale.toLowerCase();
  if (normalized === 'zh-tw') return 'zh-cn';
  if (BACKEND_TCGDEX_LOCALES.has(normalized)) return normalized;
  return null;
}

/** Maps CardTrader language_code to panel storage value (LANGUAGE_OPTIONS). */
export function mapCardTraderLangForStorage(code: string | undefined): string {
  const c = String(code || '')
    .toLowerCase()
    .trim();
  const alias: Record<string, string> = {
    jp: 'ja',
    jpn: 'ja',
    kr: 'ko',
    'zh-cn': 'zh',
    'zh-hans': 'zh',
    'zh-tw': 'zh',
    'zh-hant': 'zh',
    cn: 'zh',
    zht: 'zh',
  };
  const mapped = alias[c] || c;
  if (STORAGE_LANG_VALUES.has(mapped)) return mapped;
  return 'otro';
}

export function tcgDexApiLocaleForCardTrader(code: string | undefined): string {
  const c = String(code || '')
    .toLowerCase()
    .trim();
  return TCGDEX_API_LOCALE_BY_LANG[c] ?? 'en';
}

/** Locales to try when resolving a card id during JSON import (primary first). */
export function buildTcgDexLocaleFallbackChain(languageCode: string | undefined): string[] {
  const primary = tcgDexApiLocaleForCardTrader(languageCode);
  const chain = [primary, 'ja', 'zh-cn', 'en'];
  return [
    ...new Set(
      chain
        .map(toBackendTcgDexLocale)
        .filter((value): value is string => value != null),
    ),
  ];
}

export type TcgDexCardImportLookup = {
  id: string;
  image: string;
};

export function parseTcgDexCardFindResponse(
  data: Record<string, unknown> | null | undefined,
): TcgDexCardImportLookup | null {
  if (!data || typeof data !== 'object') return null;
  const id = data.id;
  if (typeof id !== 'string' || !id.trim()) return null;
  const images = data.images as { small?: string; large?: string } | undefined;
  const image =
    (typeof data.image === 'string' && data.image) ||
    (typeof images?.small === 'string' && images.small) ||
    (typeof images?.large === 'string' && images.large) ||
    '';
  return { id, image };
}

export async function fetchTcgDexCardForImport(
  apiFindBaseUrl: string,
  cardId: string,
  languageCode: string | undefined,
): Promise<TcgDexCardImportLookup | null> {
  const locales = buildTcgDexLocaleFallbackChain(languageCode);
  for (const locale of locales) {
    try {
      const res = await axios.get(
        `${apiFindBaseUrl}/${encodeURIComponent(cardId)}`,
        { params: { locale } },
      );
      const parsed = parseTcgDexCardFindResponse(res.data as Record<string, unknown>);
      if (parsed) return parsed;
    } catch {
      // try next locale
    }
  }
  return null;
}
