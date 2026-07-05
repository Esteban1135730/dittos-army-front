import type { IncomingHomologItem, IncomingPanelLine } from './incoming-ct0-homolog';
import { findBatchItemForCtLineName, findBatchItemForTransitLine, panelLinesForBatch } from './incoming-ct0-homolog';
import type { PackageMatchResult } from './incoming-ct0-package-match';
import {
  ctPackageLinesCoveredByBatchItems,
  matchesForBatch,
  type IncomingBatchItemForMatch,
} from './incoming-ct0-package-match';
import type { OrderTransitPackage } from './order-transit-packages';
import type { PurchasePackage } from './purchase-package-consolidated';

export type IncomingBatchLotSource = {
  batchId: string;
  purchaseDate: string;
  totalCopCardsCost?: number;
  items?: IncomingHomologItem[];
};

export type ConsolidatedTransitLot = {
  lotKey: string;
  kind: 'batch' | 'ct-only' | 'panel-only';
  batchId: string | null;
  batchPurchaseDate: string | null;
  batchTotalCopCardsCost: number | null;
  ctPackages: PurchasePackage[];
  ctMatches: PackageMatchResult[];
  orderPackages: OrderTransitPackage[];
  panelOnlyLines: IncomingPanelLine[];
  totalUnits: number;
  ctSubtotalUsd: number;
  realCopTotal: number;
};

export function computeLotRealCop(
  ctPackages: PurchasePackage[],
  panelOnlyLines: IncomingPanelLine[],
  orderPackages: OrderTransitPackage[] = [],
  batchItems: IncomingHomologItem[] = [],
): number {
  let total = 0;
  for (const pkg of ctPackages) {
    for (const line of pkg.lines) {
      if (line.lineCostCop != null) total += line.lineCostCop;
    }
  }
  for (const line of panelOnlyLines) {
    total += line.lineCostCop;
  }
  for (const pkg of orderPackages) {
    for (const line of pkg.lines) {
      const item = findBatchItemForTransitLine(
        line.name,
        line.language,
        line.unitPriceEur,
        batchItems,
      );
      const unit = item?.unit_cost_cop;
      if (unit != null && unit > 0) total += unit * line.qty;
    }
  }
  return Math.round(total);
}

function countLotUnits(
  ctPackages: PurchasePackage[],
  panelOnlyLines: IncomingPanelLine[],
  orderPackages: OrderTransitPackage[] = [],
): number {
  let units = 0;
  for (const pkg of ctPackages) units += pkg.units;
  for (const line of panelOnlyLines) units += line.qty;
  for (const pkg of orderPackages) units += pkg.units;
  return units;
}

function sumCtSubtotalUsd(packages: PurchasePackage[]): number {
  return packages.reduce((s, p) => s + p.ctSubtotalUsd, 0);
}

/** Incluye checkouts CT cuyas cartas coinciden con ítems del lote aunque falle el match de paquete. */
export function mergeCtPackagesForBatch(
  byPackageMatch: PurchasePackage[],
  allPackages: PurchasePackage[],
  batchItems: IncomingHomologItem[],
): PurchasePackage[] {
  if (batchItems.length === 0) return byPackageMatch;

  const byKey = new Map(byPackageMatch.map((p) => [p.packageKey, p]));
  const batchItemsForMatch: IncomingBatchItemForMatch[] = batchItems.map((it) => ({
    card_name: it.card_name,
    quantity_ordered: it.quantity_ordered,
    remaining_quantity: it.remaining_quantity,
  }));

  for (const pkg of allPackages) {
    if (byKey.has(pkg.packageKey)) continue;
    const lines = pkg.lines.map((line) => ({ name: line.name, qty: line.qty }));
    if (ctPackageLinesCoveredByBatchItems(lines, batchItemsForMatch)) {
      byKey.set(pkg.packageKey, pkg);
    }
  }
  return [...byKey.values()];
}

/**
 * Agrupa por lote panel (compras en camino): CT emparejados + líneas amarillas del mismo batch.
 * Checkouts CT sin lote quedan sueltos; lotes panel sin CT emparejado muestran solo amarillo.
 */
export function buildConsolidatedTransitLots(args: {
  packages: PurchasePackage[];
  orderPackages?: OrderTransitPackage[];
  orderMatches?: PackageMatchResult[];
  bundles: IncomingBatchLotSource[];
  panelOnlyLinesAll: IncomingPanelLine[];
  allMatches: PackageMatchResult[];
}): ConsolidatedTransitLot[] {
  const orderPackages = args.orderPackages ?? [];
  const orderMatches = args.orderMatches ?? [];
  const orderPackageByKey = new Map(orderPackages.map((p) => [p.packageKey, p]));

  const orderPackagesForBatch = (batchId: string): OrderTransitPackage[] => {
    const matches = matchesForBatch(orderMatches, batchId);
    return matches
      .map((m) => orderPackageByKey.get(m.ct0PackageKey))
      .filter((p): p is OrderTransitPackage => p != null);
  };
  const lots: ConsolidatedTransitLot[] = [];
  const packageByKey = new Map(args.packages.map((p) => [p.packageKey, p]));
  const matchedCtKeys = new Set<string>();

  for (const bundle of args.bundles) {
    const batchMatches = matchesForBatch(args.allMatches, bundle.batchId);
    const batchItems = bundle.items ?? [];
    const ctFromMatch = batchMatches
      .map((m) => packageByKey.get(m.ct0PackageKey))
      .filter((p): p is PurchasePackage => p != null);
    const ctPackages = mergeCtPackagesForBatch(ctFromMatch, args.packages, batchItems);

    const panelOnlyLines = panelLinesForBatch(args.panelOnlyLinesAll, bundle.batchId);
    const orderPkgs = orderPackagesForBatch(bundle.batchId);

    if (ctPackages.length > 0 || panelOnlyLines.length > 0 || orderPkgs.length > 0) {
      for (const pkg of ctPackages) matchedCtKeys.add(pkg.packageKey);

      lots.push({
        lotKey: `batch:${bundle.batchId}`,
        kind: ctPackages.length > 0 ? 'batch' : panelOnlyLines.length > 0 ? 'panel-only' : 'batch',
        batchId: bundle.batchId,
        batchPurchaseDate: bundle.purchaseDate,
        batchTotalCopCardsCost:
          bundle.totalCopCardsCost != null && bundle.totalCopCardsCost > 0
            ? Math.round(bundle.totalCopCardsCost)
            : null,
        ctPackages,
        ctMatches: batchMatches,
        orderPackages: orderPkgs,
        panelOnlyLines,
        totalUnits: countLotUnits(ctPackages, panelOnlyLines, orderPkgs),
        ctSubtotalUsd: sumCtSubtotalUsd(ctPackages),
        realCopTotal: computeLotRealCop(ctPackages, panelOnlyLines, orderPkgs, batchItems),
      });
    }
  }

  for (const pkg of args.packages) {
    if (matchedCtKeys.has(pkg.packageKey)) continue;
    lots.push({
      lotKey: `ct:${pkg.packageKey}`,
      kind: 'ct-only',
      batchId: null,
      batchPurchaseDate: null,
      batchTotalCopCardsCost: null,
      ctPackages: [pkg],
      ctMatches: [],
      orderPackages: [],
      panelOnlyLines: [],
      totalUnits: pkg.units,
      ctSubtotalUsd: pkg.ctSubtotalUsd,
      realCopTotal: computeLotRealCop([pkg], []),
    });
  }

  lots.sort((a, b) => {
    const aDate =
      a.batchPurchaseDate ??
      a.ctPackages[0]?.paidAt ??
      '';
    const bDate =
      b.batchPurchaseDate ??
      b.ctPackages[0]?.paidAt ??
      '';
    return Date.parse(bDate) - Date.parse(aDate);
  });

  return lots;
}

export function orderPackagesWithoutBatchMatch(
  orderPackages: OrderTransitPackage[],
  orderMatches: PackageMatchResult[],
): OrderTransitPackage[] {
  const matched = new Set(orderMatches.map((m) => m.ct0PackageKey));
  return orderPackages.filter((p) => !matched.has(p.packageKey));
}

export function normalizeCardSearchQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function textMatchesCardSearch(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query);
}

/** Filtra líneas del lote por nombre, idioma, expansión o id. Devuelve null si no hay coincidencias. */
export function filterConsolidatedLotBySearch(
  lot: ConsolidatedTransitLot,
  rawQuery: string,
): ConsolidatedTransitLot | null {
  const query = normalizeCardSearchQuery(rawQuery);
  if (!query) return lot;

  const ctPackages = lot.ctPackages
    .map((pkg) => ({
      ...pkg,
      lines: pkg.lines.filter(
        (line) =>
          textMatchesCardSearch(line.name, query) ||
          textMatchesCardSearch(line.expansion, query) ||
          textMatchesCardSearch(line.language, query) ||
          textMatchesCardSearch(line.condition, query),
      ),
    }))
    .filter((pkg) => pkg.lines.length > 0);

  const panelOnlyLines = lot.panelOnlyLines.filter(
    (line) =>
      textMatchesCardSearch(line.cardName, query) ||
      textMatchesCardSearch(line.cardId, query) ||
      textMatchesCardSearch(line.language, query) ||
      (line.rareza ? textMatchesCardSearch(line.rareza, query) : false),
  );

  const orderPackages = lot.orderPackages
    .map((pkg) => ({
      ...pkg,
      lines: pkg.lines.filter(
        (line) =>
          textMatchesCardSearch(line.name, query) ||
          textMatchesCardSearch(line.expansion, query) ||
          textMatchesCardSearch(line.language, query) ||
          textMatchesCardSearch(line.orderCode, query),
      ),
    }))
    .filter((pkg) => pkg.lines.length > 0);

  if (ctPackages.length === 0 && panelOnlyLines.length === 0 && orderPackages.length === 0) {
    return null;
  }

  return {
    ...lot,
    ctPackages,
    orderPackages,
    panelOnlyLines,
    totalUnits: countLotUnits(ctPackages, panelOnlyLines, orderPackages),
    ctSubtotalUsd: sumCtSubtotalUsd(ctPackages),
    realCopTotal: computeLotRealCop(ctPackages, panelOnlyLines, orderPackages),
  };
}

export function filterConsolidatedTransitLots(
  lots: ConsolidatedTransitLot[],
  rawQuery: string,
): ConsolidatedTransitLot[] {
  const query = normalizeCardSearchQuery(rawQuery);
  if (!query) return lots;
  return lots
    .map((lot) => filterConsolidatedLotBySearch(lot, query))
    .filter((lot): lot is ConsolidatedTransitLot => lot != null);
}
