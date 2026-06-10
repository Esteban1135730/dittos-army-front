import type { Ct0BoxItem, Ct0CopAllocationResult, Ct0PurchaseLot } from './cardtrader-ct0-box';
import {
  allocateCt0CopInTransit,
  ct0ItemLineUsdInTransit,
  ct0ItemQtyForState,
  ct0ItemUnitsInTransit,
  groupCt0ItemsIntoTransitLots,
} from './cardtrader-ct0-box';
import { formatCop } from './cardtrader-order-pricing';

export type IncomingOpenBatch = {
  batch_id: string;
  status: string;
  purchase_date: string;
  created_at: string;
  total_eur_cards_cost: number;
  total_cop_cards_cost: number;
  remaining_total_quantity: number;
};

export type IncomingBatchLine = {
  batch_item_id: string;
  batch_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  quantity_ordered: number;
  remaining_quantity: number;
  eur_total_lot: number;
  eur_unit_price: number;
  unit_cost_cop: number;
  rareza: string | null;
  created_at: string;
};

export type ConsolidatedSource = 'ct0' | 'incoming';

export type ConsolidatedFilter = 'all' | 'ct0-ready' | 'ct0-hub' | 'incoming';

export const CONSOLIDATED_FILTER_TABS = [
  { id: 'all' as const, label: 'Consolidado total' },
  { id: 'ct0-ready' as const, label: 'CT Zero listas' },
  { id: 'ct0-hub' as const, label: 'CT Zero en hub' },
  { id: 'incoming' as const, label: 'Compras en camino' },
];

export type ConsolidatedLine = {
  lineKey: string;
  source: ConsolidatedSource;
  name: string;
  qty: number;
  cardId: string | null;
  language: string;
  condition: string;
  variantLabel: string;
  referencePrice: string;
  unitCostCop: number | null;
  lineCostCop: number | null;
  expansion: string;
  hubState: string;
  ct0ItemId?: number;
  incomingBatchItemId?: string;
};

export type ConsolidatedLot = {
  lotKey: string;
  source: ConsolidatedSource;
  sourceLabel: string;
  title: string;
  paidAt: string | null;
  units: number;
  productLines: number;
  referenceSubtotal: string;
  referenceSubtotalCop: number | null;
  ct0Items?: Ct0BoxItem[];
  incomingBatchId?: string;
  incomingBatch?: IncomingOpenBatch;
  lines: ConsolidatedLine[];
};

export type ConsolidatedSummary = {
  ct0ReadyUnits: number;
  ct0ReadyUsd: number;
  ct0HubUnits: number;
  ct0HubUsd: number;
  incomingUnits: number;
  incomingCop: number;
  totalUnits: number;
  lotCount: number;
};

function ct0HubStateLabel(item: Ct0BoxItem): string {
  const parts: string[] = [];
  const ok = ct0ItemQtyForState(item, 'ok');
  const pending = ct0ItemQtyForState(item, 'pending');
  if (ok > 0) parts.push(`lista:${ok}`);
  if (pending > 0) parts.push(`hub:${pending}`);
  return parts.join(' · ') || '—';
}

function ct0LinePassesFilter(item: Ct0BoxItem, filter: ConsolidatedFilter): boolean {
  if (filter === 'ct0-ready') return ct0ItemQtyForState(item, 'ok') > 0;
  if (filter === 'ct0-hub') return ct0ItemQtyForState(item, 'pending') > 0;
  return ct0ItemUnitsInTransit(item) > 0;
}

function ct0LineQtyForFilter(item: Ct0BoxItem, filter: ConsolidatedFilter): number {
  if (filter === 'ct0-ready') return ct0ItemQtyForState(item, 'ok');
  if (filter === 'ct0-hub') return ct0ItemQtyForState(item, 'pending');
  return ct0ItemUnitsInTransit(item);
}

function ct0LineUsdForFilter(item: Ct0BoxItem, filter: ConsolidatedFilter): number {
  if (filter === 'ct0-ready') return ct0ItemQtyForState(item, 'ok') * (item.buyer_price?.cents ?? 0) / 100;
  if (filter === 'ct0-hub') return ct0ItemQtyForState(item, 'pending') * (item.buyer_price?.cents ?? 0) / 100;
  return ct0ItemLineUsdInTransit(item);
}

export function buildCt0ConsolidatedLot(
  lot: Ct0PurchaseLot,
  filter: ConsolidatedFilter,
  allocation: Ct0CopAllocationResult | null,
  readCondition: (props: Record<string, unknown> | undefined) => string,
  readLanguage: (props: Record<string, unknown> | undefined) => string,
  variantLabel: (props: Record<string, unknown> | undefined) => string,
): ConsolidatedLot | null {
  const allocById = new Map(allocation?.lines.map((l) => [l.itemId, l]) ?? []);
  const lines: ConsolidatedLine[] = [];

  for (const item of lot.items) {
    if (!ct0LinePassesFilter(item, filter)) continue;
    const qty = ct0LineQtyForFilter(item, filter);
    if (qty <= 0) continue;
    const alloc = allocById.get(item.id);
    const lineUsd = ct0LineUsdForFilter(item, filter);
    lines.push({
      lineKey: `ct0-${item.id}`,
      source: 'ct0',
      name: item.name,
      qty,
      cardId: null,
      language: readLanguage(item.properties),
      condition: readCondition(item.properties),
      variantLabel: variantLabel(item.properties),
      referencePrice: `$${lineUsd.toFixed(2)}`,
      unitCostCop: alloc?.unitCop ?? null,
      lineCostCop: alloc ? alloc.unitCop * qty : null,
      expansion: item.expansion,
      hubState: ct0HubStateLabel(item),
      ct0ItemId: item.id,
    });
  }

  if (lines.length === 0) return null;

  const units = lines.reduce((s, l) => s + l.qty, 0);
  const ctSubtotalUsd = lines.reduce((s, l) => s + parseFloat(l.referencePrice.replace('$', '') || '0'), 0);

  return {
    lotKey: `ct0:${lot.lotKey}`,
    source: 'ct0',
    sourceLabel: 'CardTrader Zero',
    title: `Checkout CT Zero · ${lot.paidAt ?? lot.lotKey}`,
    paidAt: lot.paidAt,
    units,
    productLines: lines.length,
    referenceSubtotal: `$${ctSubtotalUsd.toFixed(2)} USD`,
    referenceSubtotalCop: allocation?.totalCopPaid ?? null,
    ct0Items: lot.items,
    lines,
  };
}

export function buildIncomingConsolidatedLot(
  batch: IncomingOpenBatch,
  items: IncomingBatchLine[],
): ConsolidatedLot {
  const openLines = items.filter((it) => it.remaining_quantity > 0);
  const lines: ConsolidatedLine[] = openLines.map((it) => ({
    lineKey: `incoming-${it.batch_item_id}`,
    source: 'incoming',
    name: it.card_name || it.card_id,
    qty: it.remaining_quantity,
    cardId: it.card_id,
    language: it.language,
    condition: '—',
    variantLabel: it.rareza ?? 'Sin variante',
    referencePrice: `€${it.eur_total_lot.toFixed(2)}`,
    unitCostCop: it.unit_cost_cop,
    lineCostCop: it.unit_cost_cop * it.remaining_quantity,
    expansion: it.card_id,
    hubState: 'panel',
    incomingBatchItemId: it.batch_item_id,
  }));

  return {
    lotKey: `incoming:${batch.batch_id}`,
    source: 'incoming',
    sourceLabel: 'Compras en camino',
    title: `Lote panel · ${batch.purchase_date}`,
    paidAt: batch.purchase_date,
    units: batch.remaining_total_quantity,
    productLines: lines.length,
    referenceSubtotal: `€${batch.total_eur_cards_cost.toFixed(2)} · ${formatCop(batch.total_cop_cards_cost)}`,
    referenceSubtotalCop: batch.total_cop_cards_cost,
    incomingBatchId: batch.batch_id,
    incomingBatch: batch,
    lines,
  };
}

export function buildConsolidatedTransit(args: {
  ct0Items: Ct0BoxItem[];
  incomingBatches: IncomingOpenBatch[];
  incomingItemsByBatch: Record<string, IncomingBatchLine[]>;
  filter: ConsolidatedFilter;
  copByCt0LotKey: Record<string, string>;
  parseCop: (raw: string) => number | null;
  readCondition: (props: Record<string, unknown> | undefined) => string;
  readLanguage: (props: Record<string, unknown> | undefined) => string;
  variantLabel: (props: Record<string, unknown> | undefined) => string;
}): { lots: ConsolidatedLot[]; summary: ConsolidatedSummary } {
  const lots: ConsolidatedLot[] = [];

  if (args.filter !== 'incoming') {
    const ct0Lots = groupCt0ItemsIntoTransitLots(args.ct0Items);
    for (const lot of ct0Lots) {
      const copRaw = args.copByCt0LotKey[lot.lotKey] ?? '';
      const copPaid = args.parseCop(copRaw);
      const allocation =
        copPaid != null ? allocateCt0CopInTransit(lot.items, copPaid) : null;
      const built = buildCt0ConsolidatedLot(
        lot,
        args.filter,
        allocation,
        args.readCondition,
        args.readLanguage,
        args.variantLabel,
      );
      if (built) lots.push(built);
    }
  }

  if (args.filter === 'all' || args.filter === 'incoming') {
    for (const batch of args.incomingBatches) {
      if (batch.remaining_total_quantity <= 0) continue;
      const items = args.incomingItemsByBatch[batch.batch_id] ?? [];
      lots.push(buildIncomingConsolidatedLot(batch, items));
    }
  }

  lots.sort((a, b) => {
    const ta = a.paidAt ? Date.parse(a.paidAt) : 0;
    const tb = b.paidAt ? Date.parse(b.paidAt) : 0;
    return tb - ta;
  });

  const ct0Ready = args.ct0Items.reduce((s, i) => s + ct0ItemQtyForState(i, 'ok'), 0);
  const ct0Hub = args.ct0Items.reduce((s, i) => s + ct0ItemQtyForState(i, 'pending'), 0);
  const ct0ReadyUsd = args.ct0Items.reduce((s, i) => s + (i.game_id === 5 ? ct0ItemQtyForState(i, 'ok') * (i.buyer_price?.cents ?? 0) / 100 : 0), 0);
  const ct0HubUsd = args.ct0Items.reduce((s, i) => s + (i.game_id === 5 ? ct0ItemQtyForState(i, 'pending') * (i.buyer_price?.cents ?? 0) / 100 : 0), 0);
  const incomingUnits = args.incomingBatches.reduce((s, b) => s + b.remaining_total_quantity, 0);
  const incomingCop = args.incomingBatches.reduce((s, b) => s + b.total_cop_cards_cost, 0);

  return {
    lots,
    summary: {
      ct0ReadyUnits: ct0Ready,
      ct0ReadyUsd,
      ct0HubUnits: ct0Hub,
      ct0HubUsd,
      incomingUnits,
      incomingCop,
      totalUnits: ct0Ready + ct0Hub + incomingUnits,
      lotCount: lots.length,
    },
  };
}

export function flattenConsolidatedLines(lots: ConsolidatedLot[]): ConsolidatedLine[] {
  return lots.flatMap((lot) =>
    lot.lines.map((line) => ({
      ...line,
      lineKey: `${lot.lotKey}:${line.lineKey}`,
    })),
  );
}
