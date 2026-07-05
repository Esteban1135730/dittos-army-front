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
  /** Mínimo % de unidades CT con nombre presente en el lote panel (0–1). */
  nameOverlapMinRatio: 0.3,
  maxDateDiffDays: 14,
  /** Solo desempate entre candidatos; el umbral real es nameOverlapMinRatio. */
  minScore: 0.3,
};

/** Zona horaria del panel para comparar fechas de compra vs checkout CT0. */
export const TRANSIT_MATCH_TIMEZONE = 'America/Bogota';

/** Margen extra por desfases UTC vs fecha ingresada manualmente. */
export const TRANSIT_DATE_GRACE_DAYS = 1;

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

const DELTA_CHAR_RE = /[\u0394\u03b4δ]/g;

export function normalizeCardNameForMatch(name: string): string {
  return name
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(DELTA_CHAR_RE, ' δ ')
    .replace(/(\w)[''`´]s\b/g, '$1')
    .replace(/[''`´]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\sδ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Modo usado al emparejar CT0 ↔ lote legacy (nombre + fecha). */
export const TRANSIT_NAME_MATCH_MODE: 'strict' | 'relaxed' = 'relaxed';

function hasDeltaVariantMarker(normalized: string): boolean {
  return normalized.includes(' δ') || /\bdelta\s+species\b/.test(normalized);
}

/** Claves equivalentes (TCGdex acorta variantes que CardTrader escribe completas). */
export function cardNameMatchKeys(name: string): string[] {
  const normalized = normalizeCardNameForMatch(name);
  if (!normalized) return [];

  const keys = new Set<string>([normalized]);

  const withoutDeltaSpecies = normalized
    .replace(/\bdelta\s+species\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutDeltaSpecies) keys.add(withoutDeltaSpecies);

  return [...keys];
}

export function cardNamesMatchForTransit(
  aName: string,
  bName: string,
  mode: 'strict' | 'relaxed' = 'strict',
): boolean {
  const keysA = cardNameMatchKeys(aName);
  const keysB = cardNameMatchKeys(bName);

  if (keysA.some((ka) => keysB.includes(ka))) return true;

  if (mode !== 'relaxed') return false;

  for (const ka of keysA) {
    for (const kb of keysB) {
      if (ka === kb) return true;

      const [shorter, longer] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
      if (shorter.length >= 3 && longer.startsWith(shorter)) {
        const rest = longer.slice(shorter.length).trim();
        if (!rest) return true;
        if (hasDeltaVariantMarker(longer) && !hasDeltaVariantMarker(shorter)) continue;
        if (/^δ(?:\s+delta\s+species)?$/i.test(rest)) return true;
        if (/^delta\s+species$/i.test(rest)) return true;
        if (/^(?:ex|v|vmax|vstar|gx|lv x)$/i.test(rest)) return true;
      }
    }
  }

  return false;
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

export function startOfCalendarDayMs(
  iso: string,
  timeZone: string = TRANSIT_MATCH_TIMEZONE,
): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NaN;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return NaN;

  return Date.UTC(year, month - 1, day);
}

/**
 * Diferencia en días tomando el mínimo entre calendario UTC, calendario local
 * y un día de gracia por cambio horario / fechas solo-día.
 */
export function dayDiffBetweenDatesFlexible(
  aIso: string,
  bIso: string,
  timeZone: string = TRANSIT_MATCH_TIMEZONE,
): number {
  const utcDiff = dayDiffBetweenDates(startOfUtcDayMs(aIso), startOfUtcDayMs(bIso));
  const localDiff = dayDiffBetweenDates(
    startOfCalendarDayMs(aIso, timeZone),
    startOfCalendarDayMs(bIso, timeZone),
  );
  const raw = Math.min(utcDiff, localDiff);
  return Math.max(0, raw - TRANSIT_DATE_GRACE_DAYS);
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
  unit_cost_cop?: number;
  eur_unit_price?: number;
};

export function findBatchItemForCardName(
  cardName: string,
  batchItems: IncomingBatchItemForMatch[],
): IncomingBatchItemForMatch | undefined {
  for (const item of batchItems) {
    const batchQty = Math.max(item.remaining_quantity, item.quantity_ordered, 0);
    if (batchQty <= 0) continue;
    if (cardNamesMatchForTransit(cardName, item.card_name, TRANSIT_NAME_MATCH_MODE)) {
      return item;
    }
  }
  return undefined;
}

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

export function countMatchedUnitsBetweenProfiles(
  ct: Ct0PackageProfile,
  batch: IncomingBatchPackageProfile,
  mode: 'strict' | 'relaxed' = TRANSIT_NAME_MATCH_MODE,
): { matchedUnits: number; matchedUniqueNames: number } {
  const usedBatchNames = new Set<string>();
  let matchedUnits = 0;
  let matchedUniqueNames = 0;

  for (const [ctName, ctQty] of ct.nameCounts) {
    let matchedBatchName: string | null = null;
    let matchedBatchQty = 0;

    for (const [batchName, batchQty] of batch.nameCounts) {
      if (usedBatchNames.has(batchName)) continue;
      if (!cardNamesMatchForTransit(ctName, batchName, mode)) continue;
      if (batchQty > matchedBatchQty) {
        matchedBatchName = batchName;
        matchedBatchQty = batchQty;
      }
    }

    if (matchedBatchName && matchedBatchQty > 0) {
      usedBatchNames.add(matchedBatchName);
      matchedUniqueNames += 1;
      matchedUnits += Math.min(ctQty, matchedBatchQty);
    }
  }

  return { matchedUnits, matchedUniqueNames };
}

function nameOverlapRatioForProfiles(
  ct: Ct0PackageProfile,
  batch: IncomingBatchPackageProfile,
  matchedUnits: number,
  matchedUniqueNames: number,
): number {
  const ctUnits = Math.max(1, ct.totalUnits);
  const ctNames = Math.max(1, ct.uniqueNames.size);
  const byUnits = matchedUnits / ctUnits;
  const byNames = matchedUniqueNames / ctNames;
  return Math.max(byUnits, byNames);
}

/** Cada nombre CT del pedido debe existir en el lote panel (variantes δ, etc.). */
export function ctNamesCoveredByBatchProfile(
  ct: Ct0PackageProfile,
  batch: IncomingBatchPackageProfile,
): boolean {
  if (ct.uniqueNames.size === 0) return false;

  for (const ctName of ct.uniqueNames) {
    let found = false;
    for (const batchName of batch.uniqueNames) {
      if (cardNamesMatchForTransit(ctName, batchName, 'strict')) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  return true;
}

export type LegacyItemLineMatchStats = {
  ctLines: number;
  nameMatchedLines: number;
  qtyMatchedLines: number;
};

export function statsLegacyItemLineMatches(
  ctLines: Array<{ name: string; qty: number }>,
  batchItems: IncomingBatchItemForMatch[],
  mode: 'strict' | 'relaxed' = TRANSIT_NAME_MATCH_MODE,
): LegacyItemLineMatchStats {
  const activeCtLines = ctLines.filter((line) => line.qty > 0);
  const usedItemIndexes = new Set<number>();
  let nameMatchedLines = 0;
  let qtyMatchedLines = 0;

  for (const line of activeCtLines) {
    let nameMatchIndex: number | null = null;

    for (let i = 0; i < batchItems.length; i++) {
      if (usedItemIndexes.has(i)) continue;
      const item = batchItems[i];
      const batchQty = Math.max(item.remaining_quantity, item.quantity_ordered, 0);
      if (batchQty <= 0) continue;
      if (!cardNamesMatchForTransit(line.name, item.card_name, mode)) continue;
      nameMatchIndex = i;
      if (batchQty === line.qty) {
        qtyMatchedLines += 1;
      }
      break;
    }

    if (nameMatchIndex != null) {
      nameMatchedLines += 1;
      usedItemIndexes.add(nameMatchIndex);
    }
  }

  return {
    ctLines: activeCtLines.length,
    nameMatchedLines,
    qtyMatchedLines,
  };
}

export function isLegacyItemMatchAcceptable(
  stats: LegacyItemLineMatchStats,
  config: PackageMatchConfig = DEFAULT_PACKAGE_MATCH_CONFIG,
): boolean {
  if (stats.ctLines <= 0) return false;
  const nameLineRatio = stats.nameMatchedLines / stats.ctLines;
  return nameLineRatio >= config.nameOverlapMinRatio;
}

export function ctPackageLinesCoveredByBatchItems(
  lines: Array<{ name: string; qty: number }>,
  batchItems: IncomingBatchItemForMatch[],
): boolean {
  const stats = statsLegacyItemLineMatches(lines, batchItems);
  return isLegacyItemMatchAcceptable(stats);
}

export function scoreCt0ToIncomingBatchPair(
  ct: Ct0PackageProfile,
  batch: IncomingBatchPackageProfile,
  config: PackageMatchConfig = DEFAULT_PACKAGE_MATCH_CONFIG,
): Omit<PackageMatchResult, 'isSamePackage'> | null {
  const dateDiffDays = dayDiffBetweenDatesFlexible(ct.paidAt, batch.purchaseDate);
  if (dateDiffDays > config.maxDateDiffDays) return null;

  const { matchedUnits, matchedUniqueNames } = countMatchedUnitsBetweenProfiles(ct, batch);
  if (matchedUnits <= 0 && matchedUniqueNames <= 0) return null;

  const nameOverlapRatio = nameOverlapRatioForProfiles(
    ct,
    batch,
    matchedUnits,
    matchedUniqueNames,
  );
  if (nameOverlapRatio < config.nameOverlapMinRatio) return null;

  const ctUnits = Math.max(1, ct.totalUnits);
  const dateScore = 1 - dateDiffDays / (config.maxDateDiffDays + 1);
  const score = nameOverlapRatio * 0.5 + dateScore * 0.5;

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
      if (
        !best ||
        scored.score > best.score ||
        (scored.score === best.score && scored.dateDiffDays < best.dateDiffDays)
      ) {
        best = scored;
      }
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
