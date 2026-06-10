import type { IncomingPanelLine } from './incoming-ct0-homolog';
import { panelLinesForBatch } from './incoming-ct0-homolog';
import type { PackageMatchResult } from './incoming-ct0-package-match';
import { matchesForBatch } from './incoming-ct0-package-match';
import type { PurchasePackage } from './purchase-package-consolidated';

export type IncomingBatchLotSource = {
  batchId: string;
  purchaseDate: string;
  totalCopCardsCost?: number;
};

export type ConsolidatedTransitLot = {
  lotKey: string;
  kind: 'batch' | 'ct-only' | 'panel-only';
  batchId: string | null;
  batchPurchaseDate: string | null;
  batchTotalCopCardsCost: number | null;
  ctPackages: PurchasePackage[];
  ctMatches: PackageMatchResult[];
  panelOnlyLines: IncomingPanelLine[];
  totalUnits: number;
  ctSubtotalUsd: number;
  realCopTotal: number;
};

export function computeLotRealCop(
  ctPackages: PurchasePackage[],
  panelOnlyLines: IncomingPanelLine[],
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
  return Math.round(total);
}

function countLotUnits(ctPackages: PurchasePackage[], panelOnlyLines: IncomingPanelLine[]): number {
  let units = 0;
  for (const pkg of ctPackages) units += pkg.units;
  for (const line of panelOnlyLines) units += line.qty;
  return units;
}

function sumCtSubtotalUsd(packages: PurchasePackage[]): number {
  return packages.reduce((s, p) => s + p.ctSubtotalUsd, 0);
}

/**
 * Agrupa por lote panel (compras en camino): CT emparejados + líneas amarillas del mismo batch.
 * Checkouts CT sin lote quedan sueltos; lotes panel sin CT emparejado muestran solo amarillo.
 */
export function buildConsolidatedTransitLots(args: {
  packages: PurchasePackage[];
  bundles: IncomingBatchLotSource[];
  panelOnlyLinesAll: IncomingPanelLine[];
  allMatches: PackageMatchResult[];
}): ConsolidatedTransitLot[] {
  const lots: ConsolidatedTransitLot[] = [];
  const packageByKey = new Map(args.packages.map((p) => [p.packageKey, p]));
  const matchedCtKeys = new Set<string>();
  const batchIdsWithCtMatch = new Set<string>();

  for (const bundle of args.bundles) {
    const batchMatches = matchesForBatch(args.allMatches, bundle.batchId);
    const ctPackages = batchMatches
      .map((m) => packageByKey.get(m.ct0PackageKey))
      .filter((p): p is PurchasePackage => p != null);

    const panelOnlyLines = panelLinesForBatch(args.panelOnlyLinesAll, bundle.batchId);

    if (ctPackages.length > 0) {
      for (const m of batchMatches) matchedCtKeys.add(m.ct0PackageKey);
      batchIdsWithCtMatch.add(bundle.batchId);

      lots.push({
        lotKey: `batch:${bundle.batchId}`,
        kind: 'batch',
        batchId: bundle.batchId,
        batchPurchaseDate: bundle.purchaseDate,
        batchTotalCopCardsCost:
          bundle.totalCopCardsCost != null && bundle.totalCopCardsCost > 0
            ? Math.round(bundle.totalCopCardsCost)
            : null,
        ctPackages,
        ctMatches: batchMatches,
        panelOnlyLines,
        totalUnits: countLotUnits(ctPackages, panelOnlyLines),
        ctSubtotalUsd: sumCtSubtotalUsd(ctPackages),
        realCopTotal: computeLotRealCop(ctPackages, panelOnlyLines),
      });
      continue;
    }

    if (panelOnlyLines.length > 0) {
      lots.push({
        lotKey: `panel:${bundle.batchId}`,
        kind: 'panel-only',
        batchId: bundle.batchId,
        batchPurchaseDate: bundle.purchaseDate,
        batchTotalCopCardsCost:
          bundle.totalCopCardsCost != null && bundle.totalCopCardsCost > 0
            ? Math.round(bundle.totalCopCardsCost)
            : null,
        ctPackages: [],
        ctMatches: [],
        panelOnlyLines,
        totalUnits: countLotUnits([], panelOnlyLines),
        ctSubtotalUsd: 0,
        realCopTotal: computeLotRealCop([], panelOnlyLines),
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

  if (ctPackages.length === 0 && panelOnlyLines.length === 0) return null;

  return {
    ...lot,
    ctPackages,
    panelOnlyLines,
    totalUnits: countLotUnits(ctPackages, panelOnlyLines),
    ctSubtotalUsd: sumCtSubtotalUsd(ctPackages),
    realCopTotal: computeLotRealCop(ctPackages, panelOnlyLines),
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
