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

export function readCtLanguage(props: Record<string, unknown> | undefined): string {
  const raw =
    props?.pokemon_language ?? props?.mtg_language ?? props?.language ?? props?.fab_language;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
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
  const raw = props?.condition ?? props?.pokemon_condition;
  return raw != null && String(raw).trim() ? String(raw).trim() : '—';
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
  const raw =
    props?.pokemon_rarity ?? props?.mtg_rarity ?? props?.rarity ?? props?.fab_rarity;
  return raw != null && String(raw).trim() ? String(raw).trim() : '—';
}

export function listCtPropertyExtras(props: Record<string, unknown> | undefined): string[] {
  if (!props) return [];
  const skip = new Set([
    'condition',
    'pokemon_condition',
    'pokemon_language',
    'mtg_language',
    'language',
    'fab_language',
    'pokemon_rarity',
    'mtg_rarity',
    'rarity',
    'fab_rarity',
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
