import type { IncomingHomologItem } from './incoming-ct0-homolog';
import {
  findBatchItemForTransitLine,
  incomingNameMatchKey,
  normalizeMatchLanguage,
} from './incoming-ct0-homolog';

export type TransitCoverageColor = 'none' | 'yellow' | 'blue' | 'orange';

export type TransitCoverageFlags = {
  inPanel: boolean;
  inPaidSent: boolean;
  inStock: boolean;
};

export type TransitCardDescriptor = {
  name: string;
  language: string;
  cardId?: string;
  unitPriceEur?: number | null;
};

export type StockMatchRow = {
  card_id: string;
  card_name?: string;
  language?: string;
  cards_in_shipmet?: number;
  rareza?: string | null;
};

export type PaidSentMatchIndex = {
  byName: Map<string, number>;
};

export type StockMatchIndex = {
  byCardId: Map<string, number>;
  byName: Map<string, number>;
};

export const TRANSIT_COVERAGE_STYLES: Record<
  TransitCoverageColor,
  { bgcolor: string; borderColor: string; label: string }
> = {
  none: {
    bgcolor: '#ffffff',
    borderColor: '#e0e0e0',
    label: 'Stock y registro',
  },
  yellow: {
    bgcolor: '#fff8e1',
    borderColor: '#ffca28',
    label: 'Solo tu registro',
  },
  blue: {
    bgcolor: '#e3f2fd',
    borderColor: '#1565c0',
    label: 'Registro + pagado/enviado',
  },
  orange: {
    bgcolor: '#fff3e0',
    borderColor: '#ef6c00',
    label: 'Solo pagado/enviado',
  },
};

export function resolveTransitCoverageColor(flags: TransitCoverageFlags): TransitCoverageColor {
  const { inPanel, inPaidSent, inStock } = flags;
  if (inPanel && inStock) return 'none';
  if (!inPanel && inPaidSent) return 'orange';
  if (inPanel && inPaidSent) return 'blue';
  if (inPanel) return 'yellow';
  return 'none';
}

export function buildPaidSentMatchIndex(
  lines: Array<{ name: string; language: string; qty: number }>,
): PaidSentMatchIndex {
  const byName = new Map<string, number>();
  for (const line of lines) {
    const key = incomingNameMatchKey(line.name, line.language);
    byName.set(key, (byName.get(key) ?? 0) + line.qty);
  }
  return { byName };
}

export function buildStockMatchIndex(items: StockMatchRow[]): StockMatchIndex {
  const byCardId = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const it of items) {
    const qty = Math.max(0, Number(it.cards_in_shipmet) || 0);
    if (qty <= 0) continue;
    const lang = normalizeMatchLanguage(it.language);
    const cardKey = `${it.card_id.trim().toLowerCase()}|${lang}`;
    byCardId.set(cardKey, (byCardId.get(cardKey) ?? 0) + qty);
    const nameKey = incomingNameMatchKey(it.card_name ?? it.card_id, lang);
    byName.set(nameKey, (byName.get(nameKey) ?? 0) + qty);
  }
  return { byCardId, byName };
}

function hasPaidSentMatch(desc: TransitCardDescriptor, index: PaidSentMatchIndex): boolean {
  const key = incomingNameMatchKey(desc.name, desc.language);
  return (index.byName.get(key) ?? 0) > 0;
}

function hasStockMatch(desc: TransitCardDescriptor, index: StockMatchIndex): boolean {
  const lang = normalizeMatchLanguage(desc.language);
  if (desc.cardId) {
    const cardKey = `${desc.cardId.trim().toLowerCase()}|${lang}`;
    if ((index.byCardId.get(cardKey) ?? 0) > 0) return true;
  }
  const nameKey = incomingNameMatchKey(desc.name, desc.language);
  return (index.byName.get(nameKey) ?? 0) > 0;
}

function hasPanelMatch(
  desc: TransitCardDescriptor,
  batchItems: IncomingHomologItem[] | undefined,
): boolean {
  if (!batchItems?.length) return false;
  return (
    findBatchItemForTransitLine(
      desc.name,
      desc.language,
      desc.unitPriceEur ?? null,
      batchItems,
    ) != null
  );
}

export function computeTransitCoverage(args: {
  desc: TransitCardDescriptor;
  batchItems?: IncomingHomologItem[];
  paidSentIndex: PaidSentMatchIndex;
  stockIndex: StockMatchIndex;
  /** Línea del API paid/sent/done (no CT Zero). */
  isApiInTransitLine?: boolean;
  /** Forzar presencia en panel (p. ej. línea del batch). */
  forceInPanel?: boolean;
}): { flags: TransitCoverageFlags; color: TransitCoverageColor } {
  const flags: TransitCoverageFlags = {
    inPanel: args.forceInPanel === true || hasPanelMatch(args.desc, args.batchItems),
    inPaidSent:
      args.isApiInTransitLine === true || hasPaidSentMatch(args.desc, args.paidSentIndex),
    inStock: hasStockMatch(args.desc, args.stockIndex),
  };
  return { flags, color: resolveTransitCoverageColor(flags) };
}
