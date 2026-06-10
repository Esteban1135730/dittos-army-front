import type { Ct0BoxItem } from './cardtrader-ct0-box';
import { ct0ItemUnitsInTransit, filterCt0ItemsInTransit } from './cardtrader-ct0-box';

export type IncomingHomologItem = {
  batch_item_id: string;
  card_id: string;
  card_name: string;
  language: string;
  quantity_ordered: number;
  remaining_quantity: number;
  rareza?: string | null;
  unit_cost_cop?: number;
  image_url?: string;
  eur_unit_price?: number;
};

/** Línea del panel sin cobertura en CT Zero — se muestra en amarillo en el consolidado. */
export type IncomingPanelLine = {
  batchItemId: string;
  batchId: string;
  cardId: string;
  cardName: string;
  language: string;
  rareza: string | null;
  qty: number;
  unitCostCop: number;
  lineCostCop: number;
  eurUnitPrice: number | null;
  imageUrl: string;
};

export type Ct0HomologBucket = {
  totalQty: number;
};

export type Ct0HomologIndex = {
  byCardId: Map<string, Ct0HomologBucket>;
  byName: Map<string, Ct0HomologBucket>;
  ct0UnitsTotal: number;
};

export type IncomingHomologStatus = {
  batchItemId: string;
  inCt0: boolean;
  ct0MatchedQty: number;
  incomingRemainingQty: number;
  missingFromCt0Qty: number;
  onlyInIncoming: boolean;
  matchMethod: 'card_id' | 'name' | 'none';
};

export type IncomingHomologSummary = {
  totalLines: number;
  linesWithRemaining: number;
  matchedLines: number;
  onlyIncomingLines: number;
  onlyIncomingUnits: number;
  ct0UnitsTotal: number;
  matchedUnits: number;
};

export function normalizeMatchLanguage(raw: string | undefined): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  const alias: Record<string, string> = { jp: 'ja', jpn: 'ja', por: 'pt' };
  return alias[s] ?? s;
}

export function normalizeRarezaKey(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function incomingCardMatchKey(item: IncomingHomologItem): string {
  return `${item.card_id}|${normalizeMatchLanguage(item.language)}|${normalizeRarezaKey(item.rareza)}`;
}

export function incomingNameMatchKey(name: string, language: string): string {
  return `${name.trim().toLowerCase()}|${normalizeMatchLanguage(language)}`;
}

function addQty(map: Map<string, Ct0HomologBucket>, key: string, qty: number): void {
  if (qty <= 0 || !key) return;
  const prev = map.get(key);
  if (prev) {
    prev.totalQty += qty;
  } else {
    map.set(key, { totalQty: qty });
  }
}

export function buildCt0HomologIndex(args: {
  ct0Items: Ct0BoxItem[];
  tcgdxByCt0ItemId?: Record<number, string | null>;
  readLanguage: (props: Record<string, unknown> | undefined) => string;
  readRareza: (props: Record<string, unknown> | undefined) => string | null;
  pokemonOnly?: boolean;
}): Ct0HomologIndex {
  const byCardId = new Map<string, Ct0HomologBucket>();
  const byName = new Map<string, Ct0HomologBucket>();
  const tcgdx = args.tcgdxByCt0ItemId ?? {};
  let ct0UnitsTotal = 0;

  for (const item of filterCt0ItemsInTransit(args.ct0Items, args.pokemonOnly !== false)) {
    const qty = ct0ItemUnitsInTransit(item);
    if (qty <= 0) continue;
    ct0UnitsTotal += qty;

    const lang = args.readLanguage(item.properties);
    const rareza = args.readRareza(item.properties);
    addQty(byName, incomingNameMatchKey(item.name, lang), qty);

    const tcgId = tcgdx[item.id];
    if (tcgId) {
      addQty(
        byCardId,
        `${tcgId}|${normalizeMatchLanguage(lang)}|${normalizeRarezaKey(rareza)}`,
        qty,
      );
    }
  }

  return { byCardId, byName, ct0UnitsTotal };
}

function cloneIndex(index: Ct0HomologIndex): Ct0HomologIndex {
  const cloneMap = (src: Map<string, Ct0HomologBucket>) => {
    const out = new Map<string, Ct0HomologBucket>();
    for (const [k, v] of src) out.set(k, { totalQty: v.totalQty });
    return out;
  };
  return {
    byCardId: cloneMap(index.byCardId),
    byName: cloneMap(index.byName),
    ct0UnitsTotal: index.ct0UnitsTotal,
  };
}

function takeQty(bucket: Ct0HomologBucket | undefined, wanted: number): number {
  if (!bucket || wanted <= 0 || bucket.totalQty <= 0) return 0;
  const taken = Math.min(wanted, bucket.totalQty);
  bucket.totalQty -= taken;
  return taken;
}

export function homologateIncomingItems(
  items: IncomingHomologItem[],
  ct0Index: Ct0HomologIndex,
): Map<string, IncomingHomologStatus> {
  const available = cloneIndex(ct0Index);
  const out = new Map<string, IncomingHomologStatus>();

  for (const it of items) {
    const remaining = Math.max(0, it.remaining_quantity);
    if (remaining <= 0) {
      out.set(it.batch_item_id, {
        batchItemId: it.batch_item_id,
        inCt0: true,
        ct0MatchedQty: 0,
        incomingRemainingQty: 0,
        missingFromCt0Qty: 0,
        onlyInIncoming: false,
        matchMethod: 'none',
      });
      continue;
    }

    let matched = 0;
    let matchMethod: IncomingHomologStatus['matchMethod'] = 'none';

    const cardKey = incomingCardMatchKey(it);
    const fromCard = takeQty(available.byCardId.get(cardKey), remaining);
    if (fromCard > 0) {
      matched += fromCard;
      matchMethod = 'card_id';
    }

    if (matched < remaining) {
      const nameKey = incomingNameMatchKey(it.card_name || it.card_id, it.language);
      const fromName = takeQty(available.byName.get(nameKey), remaining - matched);
      if (fromName > 0) {
        matched += fromName;
        if (matchMethod === 'none') matchMethod = 'name';
      }
    }

    const missing = remaining - matched;
    out.set(it.batch_item_id, {
      batchItemId: it.batch_item_id,
      inCt0: matched > 0,
      ct0MatchedQty: matched,
      incomingRemainingQty: remaining,
      missingFromCt0Qty: missing,
      onlyInIncoming: missing > 0,
      matchMethod,
    });
  }

  return out;
}

export function summarizeIncomingHomolog(
  statuses: Iterable<IncomingHomologStatus>,
  ct0UnitsTotal: number,
): IncomingHomologSummary {
  let totalLines = 0;
  let linesWithRemaining = 0;
  let matchedLines = 0;
  let onlyIncomingLines = 0;
  let onlyIncomingUnits = 0;
  let matchedUnits = 0;

  for (const s of statuses) {
    totalLines += 1;
    if (s.incomingRemainingQty <= 0) continue;
    linesWithRemaining += 1;
    if (s.ct0MatchedQty > 0) {
      matchedLines += 1;
      matchedUnits += s.ct0MatchedQty;
    }
    if (s.onlyInIncoming) {
      onlyIncomingLines += 1;
      onlyIncomingUnits += s.missingFromCt0Qty;
    }
  }

  return {
    totalLines,
    linesWithRemaining,
    matchedLines,
    onlyIncomingLines,
    onlyIncomingUnits,
    ct0UnitsTotal,
    matchedUnits,
  };
}

export function buildPanelOnlyLines(
  bundles: Array<{ batchId: string; items: IncomingHomologItem[] }>,
  homologByItemId: Map<string, IncomingHomologStatus>,
): IncomingPanelLine[] {
  const lines: IncomingPanelLine[] = [];

  for (const bundle of bundles) {
    for (const it of bundle.items) {
      const homolog = homologByItemId.get(it.batch_item_id);
      if (!homolog?.onlyInIncoming || homolog.missingFromCt0Qty <= 0) continue;

      const qty = homolog.missingFromCt0Qty;
      const unitCostCop = Math.max(0, Number(it.unit_cost_cop) || 0);
      lines.push({
        batchItemId: it.batch_item_id,
        batchId: bundle.batchId,
        cardId: it.card_id,
        cardName: it.card_name || it.card_id,
        language: it.language,
        rareza: it.rareza ?? null,
        qty,
        unitCostCop,
        lineCostCop: unitCostCop * qty,
        eurUnitPrice:
          it.eur_unit_price != null && Number.isFinite(it.eur_unit_price)
            ? it.eur_unit_price
            : null,
        imageUrl: it.image_url?.trim() ?? '',
      });
    }
  }

  lines.sort((a, b) => a.cardName.localeCompare(b.cardName, 'es'));
  return lines;
}

export function findBatchItemForCtLineName(
  lineName: string,
  lineLanguage: string,
  batchItems: IncomingHomologItem[],
): IncomingHomologItem | undefined {
  const key = incomingNameMatchKey(lineName, lineLanguage);
  const exact = batchItems.find(
    (it) => incomingNameMatchKey(it.card_name || it.card_id, it.language) === key,
  );
  if (exact) return exact;

  const nameNorm = lineName.trim().toLowerCase();
  return batchItems.find((it) => (it.card_name || it.card_id).trim().toLowerCase() === nameNorm);
}

/** Suma unit_cost_cop × qty de líneas CT emparejadas por nombre con el lote panel. */
export function computeSuggestedCopFromBatchItems(
  lines: Array<{ name: string; qty: number; language: string }>,
  batchItems: IncomingHomologItem[],
): number | null {
  let total = 0;
  let matched = false;
  for (const line of lines) {
    const item = findBatchItemForCtLineName(line.name, line.language, batchItems);
    const unit = item?.unit_cost_cop;
    if (unit != null && unit > 0) {
      total += unit * line.qty;
      matched = true;
    }
  }
  return matched ? Math.round(total) : null;
}

export function panelLinesForBatch(
  lines: IncomingPanelLine[],
  batchId: string,
): IncomingPanelLine[] {
  return lines.filter((l) => l.batchId === batchId);
}
