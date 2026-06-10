import type { Ct0BoxItem, Ct0QuantityState } from './cardtrader-ct0-box';
import {
  ct0ItemQtyForState,
  filterCt0ItemsAll,
} from './cardtrader-ct0-box';
import { moneyToUnits } from './cardtrader-order-pricing';
import type { IncomingHomologItem } from './incoming-ct0-homolog';
import {
  incomingNameMatchKey,
  normalizeMatchLanguage,
  pricesMatchForTransit,
} from './incoming-ct0-homolog';
import { normalizeCardNameForMatch } from './incoming-ct0-package-match';
import type { OrderTransitLine, OrderTransitPackage } from './order-transit-packages';

export type Ct0MatchSegment = {
  ct0ItemId: number;
  blueprintId: number;
  qty: number;
  stateLabels: string[];
  referencePrice: string;
  expansion: string;
};

export type OrderMatchSegment = {
  lineKey: string;
  orderId: number;
  orderCode: string;
  orderState: string;
  qty: number;
  referencePrice: string;
};

export type BatchConsolidatedLine = {
  batchItemId: string;
  cardId: string;
  cardName: string;
  language: string;
  rareza: string | null;
  qty: number;
  unitCostCop: number;
  lineCostCop: number;
  eurUnitPrice: number | null;
  imageUrl: string;
  ct0Matches: Ct0MatchSegment[];
  orderMatches: OrderMatchSegment[];
  ct0Units: number;
  orderUnits: number;
  /** Sin match en CT Zero ni pedidos — solo tu registro (rojo). */
  panelOnlyUnits: number;
};

export type SoloCardtraderLine = {
  source: 'ct0' | 'order';
  lineKey: string;
  name: string;
  language: string;
  qty: number;
  label: string;
  referencePrice: string;
  blueprintId?: number;
  orderCode?: string;
};

export type BatchConsolidatedPackage = {
  batchId: string;
  purchaseDate: string;
  totalCopCardsCost: number | null;
  lines: BatchConsolidatedLine[];
  totalUnits: number;
  realCopTotal: number;
};

type Ct0PoolRow = {
  item: Ct0BoxItem;
  remaining: Record<Ct0QuantityState, number>;
};

type OrderPoolRow = OrderTransitLine & { remainingQty: number };

const CT0_STATE_LABELS: Record<Ct0QuantityState, string> = {
  ok: 'Listas CT Zero',
  pending: 'En camino al hub',
  missing: 'No disponible CT',
};

function namesMatch(aName: string, aLang: string, bName: string, bLang: string): boolean {
  if (incomingNameMatchKey(aName, aLang) === incomingNameMatchKey(bName, bLang)) return true;
  return normalizeCardNameForMatch(aName) === normalizeCardNameForMatch(bName);
}

function ct0ReferencePrice(item: Ct0BoxItem): string {
  const unit = moneyToUnits(item.buyer_price);
  const cur = item.buyer_price?.currency ?? 'USD';
  return unit > 0 ? `${unit.toFixed(2)} ${cur}` : '—';
}

function buildCt0Pool(items: Ct0BoxItem[]): Ct0PoolRow[] {
  return filterCt0ItemsAll(items).map((item) => ({
    item,
    remaining: {
      ok: ct0ItemQtyForState(item, 'ok'),
      pending: ct0ItemQtyForState(item, 'pending'),
      missing: ct0ItemQtyForState(item, 'missing'),
    },
  }));
}

function buildOrderPool(packages: OrderTransitPackage[]): OrderPoolRow[] {
  return packages.flatMap((pkg) =>
    pkg.lines.map((line) => ({ ...line, remainingQty: line.qty })),
  );
}

function takeCt0Units(
  pool: Ct0PoolRow[],
  panelItem: IncomingHomologItem,
  ct0Language: (item: Ct0BoxItem) => string,
  maxQty: number,
): Ct0MatchSegment[] {
  const out: Ct0MatchSegment[] = [];
  let need = maxQty;
  if (need <= 0) return out;

  for (const row of pool) {
    if (need <= 0) break;
    const lang = normalizeMatchLanguage(ct0Language(row.item));
    if (
      !namesMatch(row.item.name, lang, panelItem.card_name || panelItem.card_id, panelItem.language)
    ) {
      continue;
    }

    const stateLabels: string[] = [];
    let takenTotal = 0;
    for (const state of ['ok', 'pending', 'missing'] as Ct0QuantityState[]) {
      if (need <= 0) break;
      const take = Math.min(row.remaining[state], need);
      if (take <= 0) continue;
      row.remaining[state] -= take;
      need -= take;
      takenTotal += take;
      stateLabels.push(`${CT0_STATE_LABELS[state]} ×${take}`);
    }

    if (takenTotal > 0) {
      const prev = out.find((m) => m.ct0ItemId === row.item.id);
      if (prev) {
        prev.qty += takenTotal;
        prev.stateLabels.push(...stateLabels);
      } else {
        out.push({
          ct0ItemId: row.item.id,
          blueprintId: row.item.blueprint_id,
          qty: takenTotal,
          stateLabels,
          referencePrice: ct0ReferencePrice(row.item),
          expansion: row.item.expansion,
        });
      }
    }
  }

  return out;
}

function orderMatchesPanelItem(line: OrderPoolRow, panelItem: IncomingHomologItem): boolean {
  if (
    !namesMatch(line.name, line.language, panelItem.card_name || panelItem.card_id, panelItem.language)
  ) {
    return false;
  }
  if (line.unitPriceEur != null && panelItem.eur_unit_price != null && panelItem.eur_unit_price > 0) {
    return pricesMatchForTransit(line.unitPriceEur, panelItem.eur_unit_price);
  }
  return true;
}

function takeOrderUnits(
  pool: OrderPoolRow[],
  panelItem: IncomingHomologItem,
  maxQty: number,
): OrderMatchSegment[] {
  const out: OrderMatchSegment[] = [];
  let need = maxQty;
  if (need <= 0) return out;

  for (const row of pool) {
    if (need <= 0) break;
    if (row.remainingQty <= 0) continue;
    if (!orderMatchesPanelItem(row, panelItem)) continue;

    const take = Math.min(row.remainingQty, need);
    row.remainingQty -= take;
    need -= take;

    const prev = out.find((m) => m.lineKey === row.lineKey);
    if (prev) {
      prev.qty += take;
    } else {
      out.push({
        lineKey: row.lineKey,
        orderId: row.orderId,
        orderCode: row.orderCode,
        orderState: row.orderState,
        qty: take,
        referencePrice: row.referencePrice,
      });
    }
  }

  return out;
}

function compareBatchConsolidatedLines(
  a: BatchConsolidatedLine,
  b: BatchConsolidatedLine,
): number {
  const priority = (line: BatchConsolidatedLine) => {
    if (line.panelOnlyUnits === line.qty) return 0;
    if (line.panelOnlyUnits > 0) return 1;
    if (line.orderUnits > 0) return 2;
    if (line.ct0Units > 0) return 3;
    return 4;
  };
  const diff = priority(a) - priority(b);
  if (diff !== 0) return diff;
  return a.cardName.localeCompare(b.cardName, 'es');
}

export function groupBatchConsolidatedLines(lines: BatchConsolidatedLine[]): {
  soloRegistro: BatchConsolidatedLine[];
  conEnvio: BatchConsolidatedLine[];
  otras: BatchConsolidatedLine[];
} {
  const soloRegistro: BatchConsolidatedLine[] = [];
  const conEnvio: BatchConsolidatedLine[] = [];
  const otras: BatchConsolidatedLine[] = [];

  for (const line of lines) {
    if (line.panelOnlyUnits === line.qty) {
      soloRegistro.push(line);
    } else if (line.orderUnits > 0) {
      conEnvio.push(line);
    } else {
      otras.push(line);
    }
  }

  return { soloRegistro, conEnvio, otras };
}

function collectSoloCardtrader(
  ct0Pool: Ct0PoolRow[],
  orderPool: OrderPoolRow[],
  ct0Language: (item: Ct0BoxItem) => string,
): SoloCardtraderLine[] {
  const out: SoloCardtraderLine[] = [];

  for (const row of ct0Pool) {
    for (const state of ['ok', 'pending', 'missing'] as Ct0QuantityState[]) {
      const qty = row.remaining[state];
      if (qty <= 0) continue;
      out.push({
        source: 'ct0',
        lineKey: `solo-ct0-${row.item.id}-${state}`,
        name: row.item.name,
        language: normalizeMatchLanguage(ct0Language(row.item)) || '—',
        qty,
        label: CT0_STATE_LABELS[state],
        referencePrice: ct0ReferencePrice(row.item),
        blueprintId: row.item.blueprint_id,
      });
    }
  }

  for (const row of orderPool) {
    if (row.remainingQty <= 0) continue;
    out.push({
      source: 'order',
      lineKey: `solo-order-${row.lineKey}`,
      name: row.name,
      language: row.language,
      qty: row.remainingQty,
      label: row.orderState,
      referencePrice: row.referencePrice,
      orderCode: row.orderCode,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return out;
}

export function buildBatchConsolidatedPackages(args: {
  bundles: Array<{
    batchId: string;
    purchaseDate: string;
    totalCopCardsCost?: number;
    items: IncomingHomologItem[];
  }>;
  ct0Items: Ct0BoxItem[];
  orderPackages: OrderTransitPackage[];
  readCt0Language: (item: Ct0BoxItem) => string;
}): { packages: BatchConsolidatedPackage[]; soloCardtrader: SoloCardtraderLine[] } {
  const ct0Pool = buildCt0Pool(args.ct0Items);
  const orderPool = buildOrderPool(args.orderPackages);
  const packages: BatchConsolidatedPackage[] = [];

  const sortedBundles = [...args.bundles].sort(
    (a, b) => Date.parse(b.purchaseDate) - Date.parse(a.purchaseDate),
  );

  for (const bundle of sortedBundles) {
    const lines: BatchConsolidatedLine[] = [];

    for (const it of bundle.items) {
      const qty = Math.max(0, it.remaining_quantity);
      if (qty <= 0) continue;

      const unitCostCop = Math.max(0, Number(it.unit_cost_cop) || 0);
      const ct0Matches = takeCt0Units(ct0Pool, it, args.readCt0Language, qty);
      const ct0Units = ct0Matches.reduce((s, m) => s + m.qty, 0);

      const orderMatches = takeOrderUnits(orderPool, it, qty - ct0Units);
      const orderUnits = orderMatches.reduce((s, m) => s + m.qty, 0);

      const panelOnlyUnits = Math.max(0, qty - ct0Units - orderUnits);

      lines.push({
        batchItemId: it.batch_item_id,
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
        ct0Matches,
        orderMatches,
        ct0Units,
        orderUnits,
        panelOnlyUnits,
      });
    }

    if (lines.length === 0) continue;

    lines.sort(compareBatchConsolidatedLines);

    packages.push({
      batchId: bundle.batchId,
      purchaseDate: bundle.purchaseDate,
      totalCopCardsCost:
        bundle.totalCopCardsCost != null && bundle.totalCopCardsCost > 0
          ? Math.round(bundle.totalCopCardsCost)
          : null,
      lines,
      totalUnits: lines.reduce((s, l) => s + l.qty, 0),
      realCopTotal: lines.reduce((s, l) => s + l.lineCostCop, 0),
    });
  }

  const soloCardtrader = collectSoloCardtrader(ct0Pool, orderPool, args.readCt0Language);

  return { packages, soloCardtrader };
}

export function filterBatchPackagesBySearch(
  packages: BatchConsolidatedPackage[],
  soloCardtrader: SoloCardtraderLine[],
  rawQuery: string,
): { packages: BatchConsolidatedPackage[]; soloCardtrader: SoloCardtraderLine[] } {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { packages, soloCardtrader };

  const filteredPackages = packages
    .map((pkg) => ({
      ...pkg,
      lines: pkg.lines.filter(
        (l) =>
          l.cardName.toLowerCase().includes(q) ||
          l.cardId.toLowerCase().includes(q) ||
          l.language.toLowerCase().includes(q),
      ),
    }))
    .filter((p) => p.lines.length > 0);

  const filteredSolo = soloCardtrader.filter(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      l.language.toLowerCase().includes(q) ||
      (l.orderCode?.toLowerCase().includes(q) ?? false),
  );

  return { packages: filteredPackages, soloCardtrader: filteredSolo };
}
