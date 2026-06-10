import type { PurchasePackage } from './purchase-package-consolidated';

export type IncomingBatchPackageProfile = {
  batchId: string;
  purchaseDate: string;
  purchaseDateMs: number;
  /** nombre normalizado → unidades */
  nameCounts: Map<string, number>;
  uniqueNames: Set<string>;
  totalUnits: number;
};

export type Ct0PackageProfile = {
  packageKey: string;
  paidAt: string;
  paidAtMs: number;
  nameCounts: Map<string, number>;
  uniqueNames: Set<string>;
  totalUnits: number;
};

export type PackageMatchConfig = {
  /** Mínimo % de unidades CT con nombre presente en el lote panel (0–1). */
  nameOverlapMinRatio: number;
  /** Días máximos entre paid_at y fecha de compra del lote. */
  maxDateDiffDays: number;
  /** Puntaje mínimo compuesto para declarar match. */
  minScore: number;
};

export const DEFAULT_PACKAGE_MATCH_CONFIG: PackageMatchConfig = {
  nameOverlapMinRatio: 0.6,
  maxDateDiffDays: 14,
  minScore: 0.55,
};

export type PackageMatchResult = {
  ct0PackageKey: string;
  ct0PaidAt: string;
  batchId: string;
  batchPurchaseDate: string;
  score: number;
  nameOverlapRatio: number;
  matchedUnits: number;
  ctUnits: number;
  dateDiffDays: number;
  matchedUniqueNames: number;
  ctUniqueNames: number;
  isSamePackage: boolean;
};

export function normalizeCardNameForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function startOfUtcDayMs(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NaN;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function dayDiffBetweenDates(aMs: number, bMs: number): number {
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(aMs - bMs) / (24 * 60 * 60 * 1000));
}

function addNameCount(map: Map<string, number>, name: string, qty: number): void {
  const key = normalizeCardNameForMatch(name);
  if (!key || qty <= 0) return;
  map.set(key, (map.get(key) ?? 0) + qty);
}

export function buildCt0PackageProfile(pkg: PurchasePackage): Ct0PackageProfile {
  const nameCounts = new Map<string, number>();
  for (const line of pkg.lines) {
    addNameCount(nameCounts, line.name, line.qty);
  }
  return {
    packageKey: pkg.packageKey,
    paidAt: pkg.paidAt,
    paidAtMs: startOfUtcDayMs(pkg.paidAt),
    nameCounts,
    uniqueNames: new Set(nameCounts.keys()),
    totalUnits: pkg.units,
  };
}

export type IncomingBatchItemForMatch = {
  card_name: string;
  quantity_ordered: number;
  remaining_quantity: number;
};

export function buildIncomingBatchProfile(
  batchId: string,
  purchaseDate: string,
  items: IncomingBatchItemForMatch[],
): IncomingBatchPackageProfile {
  const nameCounts = new Map<string, number>();
  for (const it of items) {
    const qty = Math.max(it.remaining_quantity, it.quantity_ordered, 0);
    addNameCount(nameCounts, it.card_name, qty);
  }
  let totalUnits = 0;
  for (const q of nameCounts.values()) totalUnits += q;

  return {
    batchId,
    purchaseDate,
    purchaseDateMs: startOfUtcDayMs(purchaseDate),
    nameCounts,
    uniqueNames: new Set(nameCounts.keys()),
    totalUnits,
  };
}

export function scoreCt0ToIncomingBatchPair(
  ct: Ct0PackageProfile,
  batch: IncomingBatchPackageProfile,
  config: PackageMatchConfig = DEFAULT_PACKAGE_MATCH_CONFIG,
): Omit<PackageMatchResult, 'isSamePackage'> | null {
  const dateDiffDays = dayDiffBetweenDates(ct.paidAtMs, batch.purchaseDateMs);
  if (dateDiffDays > config.maxDateDiffDays) return null;

  let matchedUnits = 0;
  let matchedUniqueNames = 0;
  for (const [name, ctQty] of ct.nameCounts) {
    const batchQty = batch.nameCounts.get(name) ?? 0;
    if (batchQty <= 0) continue;
    matchedUniqueNames += 1;
    matchedUnits += Math.min(ctQty, batchQty);
  }

  if (matchedUnits <= 0) return null;

  const ctUnits = Math.max(1, ct.totalUnits);
  const nameOverlapRatio = matchedUnits / ctUnits;
  if (nameOverlapRatio < config.nameOverlapMinRatio) return null;

  const dateScore = 1 - dateDiffDays / (config.maxDateDiffDays + 1);
  const score = nameOverlapRatio * 0.75 + dateScore * 0.25;

  if (score < config.minScore) return null;

  return {
    ct0PackageKey: ct.packageKey,
    ct0PaidAt: ct.paidAt,
    batchId: batch.batchId,
    batchPurchaseDate: batch.purchaseDate,
    score,
    nameOverlapRatio,
    matchedUnits,
    ctUnits,
    dateDiffDays,
    matchedUniqueNames,
    ctUniqueNames: ct.uniqueNames.size,
  };
}

/**
 * Empareja cada paquete CT0 (paid_at) con el lote panel más probable.
 * Varios checkouts CT pueden apuntar al mismo lote consolidado.
 */
export function matchCt0PackagesToIncomingBatches(
  ctPackages: Ct0PackageProfile[],
  batches: IncomingBatchPackageProfile[],
  config: PackageMatchConfig = DEFAULT_PACKAGE_MATCH_CONFIG,
): PackageMatchResult[] {
  const results: PackageMatchResult[] = [];

  for (const ct of ctPackages) {
    let best: Omit<PackageMatchResult, 'isSamePackage'> | null = null;

    for (const batch of batches) {
      const scored = scoreCt0ToIncomingBatchPair(ct, batch, config);
      if (!scored) continue;
      if (!best || scored.score > best.score) best = scored;
    }

    if (best) {
      results.push({ ...best, isSamePackage: true });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function matchMapByCt0PackageKey(
  matches: PackageMatchResult[],
): Map<string, PackageMatchResult> {
  return new Map(matches.map((m) => [m.ct0PackageKey, m]));
}

export function matchesForBatch(
  matches: PackageMatchResult[],
  batchId: string,
): PackageMatchResult[] {
  return matches
    .filter((m) => m.batchId === batchId)
    .sort((a, b) => Date.parse(b.ct0PaidAt) - Date.parse(a.ct0PaidAt));
}
