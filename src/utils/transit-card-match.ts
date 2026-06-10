import { normalizeOperationalRareza } from '../constants/item-rareza';
import { normalizeMatchLanguage, pricesMatchForTransit, pricesMatchRelaxedForTransit } from './incoming-ct0-homolog';
import { cardNamesMatchForTransit } from './incoming-ct0-package-match';
import { readCollectorNumber, inferOperationalRarezaFromCtProperties } from './cardtrader-order-item-map';

export type ExpansionHomologIndex = Record<string, string>;

export type PanelTransitProfile = {
  cardId: string;
  cardName: string;
  language: string;
  rareza: string | null;
  eurUnitPrice: number | null;
  tcgdxSetId: string | null;
  tcgdxLocalId: string | null;
};

export type ExternalTransitProfile = {
  name: string;
  language: string;
  expansion: string;
  collectorNumber: string | null;
  rareza: string | null;
  unitPriceEur: number | null;
  unitPrice: number;
  priceCurrency: string;
  tcgdxSetId: string | null;
};

export type TransitMatchMode = 'strict' | 'metadata' | 'relaxed';

export function normalizeExpansionName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\bpok[eé]mon\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCollectorNumber(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const withoutLeadingZeros = s.replace(/^0+(?=\d)/, '');
  return withoutLeadingZeros || '0';
}

export function parseTcgdexCardId(cardId: string): {
  tcgdxSetId: string | null;
  tcgdxLocalId: string | null;
} {
  const clean = String(cardId ?? '').trim();
  const dash = clean.lastIndexOf('-');
  if (dash <= 0 || dash >= clean.length - 1) {
    return { tcgdxSetId: null, tcgdxLocalId: null };
  }
  const tcgdxSetId = clean.slice(0, dash).trim();
  const tcgdxLocalId = normalizeCollectorNumber(clean.slice(dash + 1));
  if (!tcgdxSetId || !tcgdxLocalId) {
    return { tcgdxSetId: null, tcgdxLocalId: null };
  }
  return { tcgdxSetId, tcgdxLocalId };
}

export function registerExpansionAlias(
  index: ExpansionHomologIndex,
  alias: string,
  tcgdxSetId: string,
): void {
  const key = normalizeExpansionName(alias);
  if (!key || !tcgdxSetId) return;
  index[key] = tcgdxSetId;
}

export async function fetchExpansionHomologIndex(
  resolveExpansion: (expansion: string) => Promise<{ tcgdex_set_id?: string | null }>,
  expansions: string[],
): Promise<ExpansionHomologIndex> {
  const index: ExpansionHomologIndex = {};
  const unique = [...new Set(expansions.map((e) => e.trim()).filter(Boolean))];

  await Promise.all(
    unique.map(async (expansion) => {
      try {
        const result = await resolveExpansion(expansion);
        const setId = result.tcgdex_set_id;
        if (typeof setId === 'string' && setId.trim()) {
          registerExpansionAlias(index, expansion, setId.trim());
        }
      } catch {
        /* expansión sin homologar */
      }
    }),
  );

  return index;
}

export function buildExpansionHomologIndex(
  entries: Array<{ tcgdxSetId: string; aliases: string[] }>,
): ExpansionHomologIndex {
  const index: ExpansionHomologIndex = {};
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      registerExpansionAlias(index, alias, entry.tcgdxSetId);
    }
    registerExpansionAlias(index, entry.tcgdxSetId, entry.tcgdxSetId);
  }
  return index;
}

export function resolveTcgdexSetFromExpansion(
  expansion: string,
  index: ExpansionHomologIndex,
): string | null {
  const key = normalizeExpansionName(expansion);
  if (!key) return null;

  const direct = index[key];
  if (direct) return direct;

  for (const [alias, setId] of Object.entries(index)) {
    if (key.includes(alias) || alias.includes(key)) return setId;
  }

  return null;
}

export function inferRarezaFromCtExpansion(expansion: string): string | null {
  const e = expansion.toLowerCase();
  if (e.includes('master ball') || e.includes('masterball')) return 'masterball';
  if (e.includes('poke ball') || e.includes('pokeball') || e.includes('poké ball')) {
    return 'pokeball';
  }
  if (e.includes('reverse holo') || e.includes('reverse holofoil')) return 'foil';
  return null;
}

export function inferExternalRareza(args: {
  expansion: string;
  properties?: Record<string, unknown>;
}): string | null {
  const fromProps = inferOperationalRarezaFromCtProperties(args.properties);
  if (fromProps) return fromProps;
  return inferRarezaFromCtExpansion(args.expansion);
}

export function buildPanelTransitProfile(item: {
  card_id: string;
  card_name?: string;
  language: string;
  rareza?: string | null;
  eur_unit_price?: number | null;
}): PanelTransitProfile {
  const parsed = parseTcgdexCardId(item.card_id);
  return {
    cardId: item.card_id,
    cardName: item.card_name || item.card_id,
    language: item.language,
    rareza: normalizeOperationalRareza(item.rareza),
    eurUnitPrice:
      item.eur_unit_price != null && Number.isFinite(item.eur_unit_price)
        ? item.eur_unit_price
        : null,
    tcgdxSetId: parsed.tcgdxSetId,
    tcgdxLocalId: parsed.tcgdxLocalId,
  };
}

export function buildExternalTransitProfile(args: {
  name: string;
  language: string;
  expansion: string;
  collectorNumber?: string | null;
  rareza?: string | null;
  properties?: Record<string, unknown>;
  unitPriceEur: number | null;
  unitPrice: number;
  priceCurrency: string;
  expansionHomolog: ExpansionHomologIndex;
}): ExternalTransitProfile {
  const collectorNumber =
    normalizeCollectorNumber(args.collectorNumber) ??
    normalizeCollectorNumber(readCollectorNumber(args.properties));
  const rareza =
    normalizeOperationalRareza(args.rareza) ??
    inferExternalRareza({ expansion: args.expansion, properties: args.properties });

  return {
    name: args.name,
    language: args.language,
    expansion: args.expansion,
    collectorNumber,
    rareza,
    unitPriceEur: args.unitPriceEur,
    unitPrice: args.unitPrice,
    priceCurrency: args.priceCurrency,
    tcgdxSetId: resolveTcgdexSetFromExpansion(args.expansion, args.expansionHomolog),
  };
}

function languagesCompatible(a: string, b: string, mode: TransitMatchMode): boolean {
  const la = normalizeMatchLanguage(a);
  const lb = normalizeMatchLanguage(b);
  if (!la || !lb) return true;
  if (la === lb) return true;
  return mode === 'relaxed' || mode === 'metadata';
}

function rarezaCompatible(panel: string | null, external: string | null): boolean {
  if (!panel || !external) return true;
  return panel === external;
}

function pricesCompatible(
  panelEur: number | null,
  external: ExternalTransitProfile,
  mode: TransitMatchMode,
): boolean {
  if (panelEur == null || panelEur <= 0) return true;

  if (external.unitPriceEur != null && external.unitPriceEur > 0) {
    return mode === 'relaxed'
      ? pricesMatchRelaxedForTransit(external.unitPriceEur, panelEur)
      : pricesMatchForTransit(external.unitPriceEur, panelEur);
  }

  if (external.unitPrice > 0 && external.priceCurrency === 'EUR') {
    return mode === 'relaxed'
      ? pricesMatchRelaxedForTransit(external.unitPrice, panelEur)
      : pricesMatchForTransit(external.unitPrice, panelEur);
  }

  if (external.unitPrice > 0 && mode === 'relaxed') {
    return pricesMatchRelaxedForTransit(external.unitPrice, panelEur);
  }

  return true;
}

function tcgdxIdentityMatch(panel: PanelTransitProfile, external: ExternalTransitProfile): boolean {
  if (!panel.tcgdxSetId || !panel.tcgdxLocalId || !external.tcgdxSetId || !external.collectorNumber) {
    return false;
  }
  return (
    panel.tcgdxSetId === external.tcgdxSetId &&
    panel.tcgdxLocalId === external.collectorNumber
  );
}

function tcgdxSetMatch(panel: PanelTransitProfile, external: ExternalTransitProfile): boolean {
  if (!panel.tcgdxSetId || !external.tcgdxSetId) return false;
  return panel.tcgdxSetId === external.tcgdxSetId;
}

export function scoreTransitCardMatch(
  panel: PanelTransitProfile,
  external: ExternalTransitProfile,
): number {
  if (tcgdxIdentityMatch(panel, external)) return 0;
  if (tcgdxSetMatch(panel, external) && cardNamesMatchForTransit(panel.cardName, external.name, 'strict')) {
    return 10;
  }
  if (tcgdxSetMatch(panel, external)) return 20;
  if (cardNamesMatchForTransit(panel.cardName, external.name, 'strict')) return 40;
  if (cardNamesMatchForTransit(panel.cardName, external.name, 'relaxed')) return 60;
  return Number.POSITIVE_INFINITY;
}

export function matchTransitCards(
  panel: PanelTransitProfile,
  external: ExternalTransitProfile,
  mode: TransitMatchMode,
): boolean {
  if (!languagesCompatible(panel.language, external.language, mode)) return false;
  if (!rarezaCompatible(panel.rareza, external.rareza)) return false;
  if (!pricesCompatible(panel.eurUnitPrice, external, mode)) return false;

  if (mode === 'metadata' || mode === 'strict') {
    if (tcgdxIdentityMatch(panel, external)) return true;
    if (
      tcgdxSetMatch(panel, external) &&
      cardNamesMatchForTransit(panel.cardName, external.name, mode === 'metadata' ? 'relaxed' : 'strict')
    ) {
      return true;
    }
  }

  if (mode === 'strict') {
    return cardNamesMatchForTransit(panel.cardName, external.name, 'strict');
  }

  if (mode === 'metadata') {
    return (
      tcgdxSetMatch(panel, external) ||
      cardNamesMatchForTransit(panel.cardName, external.name, 'relaxed')
    );
  }

  return cardNamesMatchForTransit(panel.cardName, external.name, 'relaxed');
}
