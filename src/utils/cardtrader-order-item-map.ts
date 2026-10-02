import { normalizeOperationalRareza } from '../constants/item-rareza';

function isActiveTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (!s || s === 'false' || s === 'no' || s === 'none' || s === '0') return false;
    return true;
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

/** Claves de idioma en properties CardTrader, por juego (orden de prioridad). */
export const CT_LANGUAGE_KEYS = [
  'pokemon_language',
  'yugioh_language',
  'mtg_language',
  'onepiece_language',
  'language',
  'fab_language',
] as const;

/** Claves de rareza en properties / fixed_properties CardTrader. */
export const CT_RARITY_KEYS = [
  'pokemon_rarity',
  'yugioh_rarity',
  'mtg_rarity',
  'onepiece_rarity',
  'rarity',
  'fab_rarity',
] as const;

export const CT_CONDITION_KEYS = ['condition', 'pokemon_condition'] as const;

/** Primer valor de texto no vacío entre `keys` (recortado), o null. */
export function pickCtProperty(
  props: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null {
  if (!props) return null;
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function readCtLanguage(props: Record<string, unknown> | undefined): string {
  const s = (pickCtProperty(props, CT_LANGUAGE_KEYS) ?? '').toLowerCase();
  if (!s) return '—';
  const alias: Record<string, string> = { jp: 'ja', jpn: 'ja' };
  return alias[s] ?? s;
}

export function inferOperationalRarezaFromCtProperties(
  props: Record<string, unknown> | undefined,
): string | null {
  if (!props) return null;
  if (isActiveTruthy(props.first_edition)) return 'first edition';
  if (isActiveTruthy(props.master_ball_reverse_holo)) return 'masterball';
  if (isActiveTruthy(props.poke_ball_reverse_holo)) return 'pokeball';
  if (
    isActiveTruthy(props.reverse) ||
    isActiveTruthy(props.pokemon_reverse) ||
    isActiveTruthy(props.reverse_holo)
  ) {
    return 'foil';
  }
  if (
    isActiveTruthy(props.foil) ||
    isActiveTruthy(props.pokemon_foil) ||
    isActiveTruthy(props.mtg_foil) ||
    isActiveTruthy(props.holofoil)
  ) {
    return 'foil';
  }
  return normalizeOperationalRareza(null);
}

export function readCtCondition(props: Record<string, unknown> | undefined): string {
  return pickCtProperty(props, CT_CONDITION_KEYS) ?? '—';
}

export function readCollectorNumber(props: Record<string, unknown> | undefined): string | null {
  const raw = props?.collector_number;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const slashMatch = /^(\d+)\s*\/\s*\d+$/.exec(s);
  if (slashMatch) return slashMatch[1];
  const gemPackMatch = /^(\d{2}-\d{2})\/(\d{2})$/.exec(s);
  if (gemPackMatch) return `${gemPackMatch[1]}_${gemPackMatch[2]}`;
  return s;
}

export function readCtRarityLabel(props: Record<string, unknown> | undefined): string {
  return pickCtProperty(props, CT_RARITY_KEYS) ?? '—';
}

export function listCtPropertyExtras(props: Record<string, unknown> | undefined): string[] {
  if (!props) return [];
  const skip = new Set<string>([
    ...CT_CONDITION_KEYS,
    ...CT_LANGUAGE_KEYS,
    ...CT_RARITY_KEYS,
    'collector_number',
    'cmc',
    'tournament_legal',
  ]);
  const out: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (skip.has(key)) continue;
    if (!isActiveTruthy(value)) continue;
    if (typeof value === 'string' && value.trim()) {
      out.push(`${key}: ${value.trim()}`);
    } else {
      out.push(key.replace(/_/g, ' '));
    }
  }
  return out;
}

export type TcgdexResolveResponse = {
  tcgdex_card_id: string | null;
  tcgdex_set_id: string | null;
  locale: string | null;
  error: string | null;
};
