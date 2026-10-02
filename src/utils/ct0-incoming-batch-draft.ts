import type { Ct0BoxItem } from './cardtrader-ct0-box';
import { ct0ItemUnitsInTransit, filterCt0ItemsInTransit } from './cardtrader-ct0-box';
import { mapCardTraderLangForStorage } from './cardtrader-json-import';
import {
  buildCt0PackageProfile,
  buildIncomingBatchProfile,
  dayDiffBetweenDatesFlexible,
  DEFAULT_PACKAGE_MATCH_CONFIG,
  isLegacyItemMatchAcceptable,
  matchCt0PackagesToIncomingBatches,
  statsLegacyItemLineMatches,
  type IncomingBatchItemForMatch,
} from './incoming-ct0-package-match';
import {
  buildPurchasePackages,
  type PurchasePackage,
} from './purchase-package-consolidated';
import {
  inferOperationalRarezaFromCtProperties,
  readCollectorNumber,
  readCtCondition,
  readCtLanguage,
  type TcgdexResolveResponse,
} from './cardtrader-order-item-map';
import { operationalRarezaLabel } from '../constants/item-rareza';
import { OWNERS_CONFIG, type OwnerKey } from '../config/owners';
import { mapWithConcurrency } from './concurrency';

export type Ct0BatchDraftLine = {
  lineKey: string;
  ct0ItemId: number;
  productId: number;
  name: string;
  expansion: string;
  collectorNumber: string | null;
  language: string;
  qty: number;
  /** Total USD del lote para esa cantidad. */
  usdTotalLot: number;
  rareza: string | null;
  tcgdexCardId: string | null;
  tcgdexError: string | null;
  blueprintId: number;
};

export type Ct0BatchDraftStatus = 'already_registered' | 'ready' | 'homolog_error';

export type Ct0BatchDraft = {
  packageKey: string;
  paidAt: string;
  paidAtLabel: string;
  purchaseDate: string;
  status: Ct0BatchDraftStatus;
  /** Lote nuevo (cardtrader_transit_lots) si ya está registrado. */
  transitLotId: string | null;
  /** Lote legacy solo como referencia de COP. */
  legacyBatchId: string | null;
  legacyCopHint: number | null;
  /** COP tomado automáticamente del legacy (fecha + ítems/cantidades). */
  legacyCopAutoFilled: boolean;
  /** Total FX/EUR/USD original del batch legacy (lote completo, no solo CT0). */
  legacyTotalFxCardsCost: number | null;
  legacyCardsCostCurrency: string | null;
  legacyRealFxRateCop: number | null;
  matchScore: number | null;
  lines: Ct0BatchDraftLine[];
  totalUnits: number;
  usdSubtotal: number;
  unresolvedCount: number;
};

/** @deprecated Solo referencia de valor COP desde compras en camino antiguas. */
export type IncomingBatchBundleForCt0Draft = {
  batchId: string;
  purchaseDate: string;
  totalCopCardsCost?: number;
  /** Total FX original del batch legacy (campo eur_* = moneda de compra). */
  totalFxCardsCost?: number;
  cardsCostCurrency?: string;
  realFxRateCop?: number;
  items: IncomingBatchItemForMatch[];
};

/** Campos de pricing desde GET /incoming/batch/open (EUR/USD = total_eur_cards_cost). */
export function pricingFieldsFromOpenIncomingBatch(batch: {
  total_cop_cards_cost?: number;
  total_eur_cards_cost?: number;
  cards_cost_currency?: string;
}): Pick<
  IncomingBatchBundleForCt0Draft,
  'totalCopCardsCost' | 'totalFxCardsCost' | 'cardsCostCurrency' | 'realFxRateCop'
> {
  const totalCopCardsCost = batch.total_cop_cards_cost;
  const totalFxCardsCost = batch.total_eur_cards_cost;
  if (
    totalCopCardsCost == null ||
    totalCopCardsCost <= 0 ||
    totalFxCardsCost == null ||
    totalFxCardsCost <= 0
  ) {
    return {};
  }
  return {
    totalCopCardsCost,
    totalFxCardsCost,
    cardsCostCurrency: batch.cards_cost_currency ?? 'USD',
    realFxRateCop: totalCopCardsCost / totalFxCardsCost,
  };
}

export type ExistingTransitLotRef = {
  ct0_package_key: string;
  lot_id: string;
};

export type TcgdexResolveFn = (args: {
  expansion: string;
  collectorNumber: string | null;
  language: string;
  blueprintId?: number;
  name?: string;
}) => Promise<TcgdexResolveResponse>;

function formatPaidAtLabel(paidAt: string): string {
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return paidAt;
  return d.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
}

/** Normaliza un paid_at (o ct0_package_key almacenado) a precisión de minuto. */
export function normalizePaidAtToMinute(paidAt: string): string {
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return paidAt;
  d.setSeconds(0, 0);
  return d.toISOString();
}

export function purchaseDateFromPaidAt(paidAt: string): string {
  const d = new Date(paidAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function aggregatePackageLines(
  pkg: PurchasePackage,
  ct0ById: Map<number, Ct0BoxItem>,
): Omit<Ct0BatchDraftLine, 'tcgdexCardId' | 'tcgdexError'>[] {
  const merged = new Map<
    string,
    Omit<Ct0BatchDraftLine, 'tcgdexCardId' | 'tcgdexError'>
  >();

  for (const line of pkg.lines) {
    const item = ct0ById.get(line.ct0ItemId);
    const language = mapCardTraderLangForStorage(readCtLanguage(item?.properties));
    const rareza = inferOperationalRarezaFromCtProperties(item?.properties);
    const collectorNumber = readCollectorNumber(item?.properties);
    const mergeKey = `${line.ct0ItemId}:${language}:${rareza ?? ''}`;

    const prev = merged.get(mergeKey);
    if (prev) {
      prev.qty += line.qty;
      prev.usdTotalLot += line.referenceUsd;
      continue;
    }

    merged.set(mergeKey, {
      lineKey: mergeKey,
      ct0ItemId: line.ct0ItemId,
      productId: line.productId,
      name: line.name,
      expansion: line.expansion,
      collectorNumber,
      language,
      qty: line.qty,
      usdTotalLot: line.referenceUsd,
      rareza,
      blueprintId: line.blueprintId,
    });
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

type LegacyCopResolution = {
  batchId: string;
  totalCopCardsCost: number;
  totalFxCardsCost: number;
  cardsCostCurrency: string;
  realFxRateCop: number;
  matchedItemLines: number;
};

function legacyPricingFromBundle(
  bundle: IncomingBatchBundleForCt0Draft,
): Pick<
  LegacyCopResolution,
  'totalCopCardsCost' | 'totalFxCardsCost' | 'cardsCostCurrency' | 'realFxRateCop'
> | null {
  const totalCopCardsCost = bundle.totalCopCardsCost;
  const totalFxCardsCost = bundle.totalFxCardsCost;
  if (
    totalCopCardsCost == null ||
    totalCopCardsCost <= 0 ||
    totalFxCardsCost == null ||
    totalFxCardsCost <= 0
  ) {
    return null;
  }

  const realFxRateCop =
    bundle.realFxRateCop != null && bundle.realFxRateCop > 0
      ? bundle.realFxRateCop
      : totalCopCardsCost / totalFxCardsCost;

  return {
    totalCopCardsCost,
    totalFxCardsCost,
    cardsCostCurrency: bundle.cardsCostCurrency ?? 'USD',
    realFxRateCop,
  };
}

function legacyMatchStats(
  ctLines: Array<{ name: string; qty: number }>,
  batchItems: IncomingBatchItemForMatch[],
) {
  return statsLegacyItemLineMatches(ctLines, batchItems);
}

/** Empareja lote CT0 con batch legacy por fecha + nombres y cantidades del pedido. */
export function resolveLegacyCopForPackage(args: {
  paidAt: string;
  ctLines: Array<{ name: string; qty: number }>;
  packageMatchBatchId: string | null;
  legacyBundles: IncomingBatchBundleForCt0Draft[];
}): LegacyCopResolution | null {
  if (!args.paidAt?.trim()) return null;

  const tryBundle = (bundle: IncomingBatchBundleForCt0Draft): LegacyCopResolution | null => {
    const pricing = legacyPricingFromBundle(bundle);
    if (!pricing) return null;

    const stats = legacyMatchStats(args.ctLines, bundle.items);
    if (!isLegacyItemMatchAcceptable(stats)) return null;

    return {
      batchId: bundle.batchId,
      ...pricing,
      matchedItemLines: stats.nameMatchedLines,
    };
  };

  if (args.packageMatchBatchId) {
    const bundle = args.legacyBundles.find((b) => b.batchId === args.packageMatchBatchId);
    if (bundle) {
      const resolved = tryBundle(bundle);
      if (resolved) return resolved;
    }
  }

  let best: LegacyCopResolution | null = null;
  let bestDateDiff = Number.POSITIVE_INFINITY;
  let bestNameMatched = -1;

  for (const bundle of args.legacyBundles) {
    const dateDiff = dayDiffBetweenDatesFlexible(args.paidAt, bundle.purchaseDate);
    if (dateDiff > DEFAULT_PACKAGE_MATCH_CONFIG.maxDateDiffDays) continue;

    const resolved = tryBundle(bundle);
    if (!resolved) continue;

    const nameMatched = resolved.matchedItemLines;
    if (
      !best ||
      dateDiff < bestDateDiff ||
      (dateDiff === bestDateDiff && nameMatched > bestNameMatched)
    ) {
      best = resolved;
      bestNameMatched = nameMatched;
      bestDateDiff = dateDiff;
    }
  }

  return best;
}

export function buildCt0IncomingBatchDrafts(args: {
  ct0Items: Ct0BoxItem[];
  /** Lotes ya registrados en cardtrader_transit_lots. */
  existingTransitLots?: ExistingTransitLotRef[];
  /** Lotes legacy (compras en camino) solo para sugerir COP. */
  legacyIncomingBundles?: IncomingBatchBundleForCt0Draft[];
  /** CardTrader `game_id`. Default Pokémon. `null` = todos. */
  gameId?: number | null;
}): Ct0BatchDraft[] {
  const inTransit = filterCt0ItemsInTransit(args.ct0Items, args.gameId);
  const ct0ById = new Map(inTransit.map((item) => [item.id, item]));

  const { packages } = buildPurchasePackages({
    ct0Items: args.ct0Items,
    copByPackageKey: {},
    parseCop: () => null,
    readCondition: readCtCondition,
    readLanguage: readCtLanguage,
    variantLabel: (props) =>
      operationalRarezaLabel(inferOperationalRarezaFromCtProperties(props)),
    gameId: args.gameId,
  });

  // Normalize stored keys to minute precision so they match pkg.packageKey
  // regardless of whether they were saved before or after the normalization change.
  const transitByPackageKey = new Map(
    (args.existingTransitLots ?? []).map((lot) => [
      normalizePaidAtToMinute(lot.ct0_package_key),
      lot.lot_id,
    ]),
  );

  const legacyBundles = args.legacyIncomingBundles ?? [];
  const legacyProfiles = legacyBundles.map((bundle) =>
    buildIncomingBatchProfile(bundle.batchId, bundle.purchaseDate, bundle.items),
  );
  const ctProfiles = packages.map((pkg) => buildCt0PackageProfile(pkg));
  const legacyMatches = matchCt0PackagesToIncomingBatches(ctProfiles, legacyProfiles);
  const legacyMatchByPackageKey = new Map(
    legacyMatches.map((m) => [m.ct0PackageKey, m]),
  );

  return packages.map((pkg) => {
    const transitLotId = transitByPackageKey.get(pkg.packageKey) ?? null;
    const legacyMatch = legacyMatchByPackageKey.get(pkg.packageKey);
    const preLines = aggregatePackageLines(pkg, ct0ById);
    const legacyCop = resolveLegacyCopForPackage({
      paidAt: pkg.paidAt,
      ctLines: preLines.map((l) => ({ name: l.name, qty: l.qty })),
      packageMatchBatchId: legacyMatch?.batchId ?? null,
      legacyBundles,
    });
    const legacyBatchId = legacyCop?.batchId ?? null;
    const legacyCopHint = legacyCop?.totalCopCardsCost ?? null;
    const legacyCopAutoFilled = legacyCopHint != null && legacyCopHint > 0;
    const legacyTotalFxCardsCost = legacyCop?.totalFxCardsCost ?? null;
    const legacyCardsCostCurrency = legacyCop?.cardsCostCurrency ?? null;
    const legacyRealFxRateCop = legacyCop?.realFxRateCop ?? null;

    const totalUnits = preLines.reduce((s, l) => s + l.qty, 0);
    const usdSubtotal = preLines.reduce((s, l) => s + l.usdTotalLot, 0);
    const alreadyRegistered = transitLotId != null;

    return {
      packageKey: pkg.packageKey,
      paidAt: pkg.paidAt,
      paidAtLabel: formatPaidAtLabel(pkg.paidAt),
      purchaseDate: purchaseDateFromPaidAt(pkg.paidAt),
      status: alreadyRegistered ? 'already_registered' : 'ready',
      transitLotId,
      legacyBatchId,
      legacyCopHint,
      legacyCopAutoFilled,
      legacyTotalFxCardsCost,
      legacyCardsCostCurrency,
      legacyRealFxRateCop,
      matchScore: legacyMatch?.score ?? null,
      lines: preLines.map((line) => ({
        ...line,
        tcgdexCardId: null,
        tcgdexError: alreadyRegistered ? null : 'pendiente de homologación',
      })),
      totalUnits,
      usdSubtotal,
      unresolvedCount: alreadyRegistered ? 0 : preLines.length,
    };
  });
}

export async function resolveCt0BatchDraftTcgdex(
  drafts: Ct0BatchDraft[],
  resolveTcgdex: TcgdexResolveFn,
): Promise<Ct0BatchDraft[]> {
  const cache = new Map<string, Promise<TcgdexResolveResponse>>();

  const resolveOne = (
    expansion: string,
    collectorNumber: string | null,
    language: string,
    blueprintId: number | undefined,
    name: string,
  ): Promise<TcgdexResolveResponse> => {
    const identity = collectorNumber?.trim()
      ? collectorNumber
      : name.trim().toLowerCase();
    const cacheKey = `${language.toLowerCase()}|${expansion.toLowerCase()}|${identity}|${blueprintId ?? ''}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const pending = resolveTcgdex({
      expansion,
      collectorNumber,
      language,
      blueprintId,
      name,
    });
    cache.set(cacheKey, pending);
    return pending;
  };

  const linesToResolve = drafts.flatMap((draft) =>
    draft.status === 'already_registered' ? [] : draft.lines,
  );
  const resolvedList = await mapWithConcurrency(linesToResolve, (line) =>
    resolveOne(
      line.expansion,
      line.collectorNumber,
      line.language,
      line.blueprintId,
      line.name,
    ),
  );
  const resolvedByLine = new Map(
    linesToResolve.map((line, i) => [line, resolvedList[i]] as const),
  );

  const out: Ct0BatchDraft[] = [];

  for (const draft of drafts) {
    if (draft.status === 'already_registered') {
      out.push({
        ...draft,
        lines: draft.lines.map((line) => ({
          ...line,
          tcgdexCardId: null,
          tcgdexError: null,
        })),
        unresolvedCount: 0,
      });
      continue;
    }

    const lines: Ct0BatchDraftLine[] = [];
    let unresolvedCount = 0;

    for (const line of draft.lines) {
      const resolved = resolvedByLine.get(line)!;
      if (resolved.tcgdex_card_id) {
        lines.push({
          ...line,
          tcgdexCardId: resolved.tcgdex_card_id,
          tcgdexError: null,
        });
      } else {
        unresolvedCount += 1;
        lines.push({
          ...line,
          tcgdexCardId: null,
          tcgdexError: resolved.error ?? 'sin homologación TCGdex',
        });
      }
    }

    out.push({
      ...draft,
      lines,
      status: unresolvedCount > 0 ? 'homolog_error' : 'ready',
      unresolvedCount,
    });
  }

  return out;
}

export function draftsEligibleForRegistration(drafts: Ct0BatchDraft[]): Ct0BatchDraft[] {
  return drafts.filter((d) => d.status === 'ready');
}

export type ComplementosDraftLine = {
  lineKey: string;
  ct0ItemId: number;
  productId: number;
  blueprintId: number;
  name: string;
  expansion: string;
  collectorNumber: string | null;
  language: string;
  qty: number;
  rareza: string | null;
  tcgdexCardId: string | null;
  tcgdexError: string | null;
};

export function buildComplementosDraftLines(
  items: Ct0BoxItem[],
): Omit<ComplementosDraftLine, 'tcgdexCardId' | 'tcgdexError'>[] {
  const lines: Omit<ComplementosDraftLine, 'tcgdexCardId' | 'tcgdexError'>[] = [];
  for (const item of items) {
    const qty = ct0ItemUnitsInTransit(item);
    if (qty <= 0) continue;
    const language = mapCardTraderLangForStorage(readCtLanguage(item.properties));
    const rareza = inferOperationalRarezaFromCtProperties(item.properties);
    lines.push({
      lineKey: `comp-${item.id}`,
      ct0ItemId: item.id,
      productId: item.product_id,
      blueprintId: item.blueprint_id,
      name: item.name,
      expansion: item.expansion,
      collectorNumber: readCollectorNumber(item.properties),
      language,
      qty,
      rareza,
    });
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function resolveComplementosDraftTcgdex(
  lines: Omit<ComplementosDraftLine, 'tcgdexCardId' | 'tcgdexError'>[],
  resolveTcgdex: TcgdexResolveFn,
): Promise<ComplementosDraftLine[]> {
  const cache = new Map<string, Promise<TcgdexResolveResponse>>();

  return mapWithConcurrency(lines, async (line): Promise<ComplementosDraftLine> => {
    const identity = line.collectorNumber?.trim()
      ? line.collectorNumber
      : line.name.trim().toLowerCase();
    const cacheKey = `${line.language.toLowerCase()}|${line.expansion.toLowerCase()}|${identity}|${line.blueprintId ?? ''}`;
    let pending = cache.get(cacheKey);
    if (!pending) {
      pending = resolveTcgdex({
        expansion: line.expansion,
        collectorNumber: line.collectorNumber,
        language: line.language,
        blueprintId: line.blueprintId,
        name: line.name,
      });
      cache.set(cacheKey, pending);
    }
    const resolved = await pending;
    if (resolved.tcgdex_card_id) {
      return {
        ...line,
        tcgdexCardId: resolved.tcgdex_card_id,
        tcgdexError: null,
      };
    }
    return {
      ...line,
      tcgdexCardId: null,
      tcgdexError: resolved.error ?? 'sin homologación TCGdex',
    };
  });
}

export function buildComplementosTransitLotPayload(
  lines: ComplementosDraftLine[],
  purchaseDate: string,
  packageKey: string,
  owner: OwnerKey = OWNERS_CONFIG.defaultOwner,
): CreateTransitLotPayload {
  const ready = lines.filter((l) => l.tcgdexCardId);
  return {
    items: ready.map((line) => ({
      card_id: line.tcgdexCardId!,
      card_name: line.name,
      language: line.language,
      quantity: line.qty,
      fx_total_lot: 0,
      rareza: line.rareza,
      ct0_item_id: line.ct0ItemId,
      product_id: line.productId > 0 ? line.productId : undefined,
      blueprint_id: line.blueprintId,
      expansion: line.expansion,
      collector_number: line.collectorNumber,
    })),
    total_cop_cards_cost: 0,
    purchase_date: purchaseDate,
    cards_cost_currency: 'USD',
    source: 'complementos',
    ct0_package_key: packageKey,
    owner,
  };
}

export type CreateTransitLotPayload = {
  items: Array<{
    card_id: string;
    card_name: string;
    language: string;
    quantity: number;
    fx_total_lot: number;
    rareza: string | null;
    ct0_item_id?: number;
    product_id?: number;
    blueprint_id?: number;
    expansion?: string;
    collector_number?: string | null;
  }>;
  total_cop_cards_cost: number;
  purchase_date: string;
  cards_cost_currency: string;
  source: 'ct0' | 'manual' | 'complementos';
  ct0_package_key: string;
  legacy_incoming_batch_id?: string;
  legacy_incoming_cop_hint?: number;
  legacy_basis_total_fx_cards_cost?: number;
  legacy_basis_total_cop_cards_cost?: number;
  legacy_basis_real_fx_rate_cop?: number;
  legacy_basis_cards_cost_currency?: string;
  owner?: OwnerKey;
};

export function buildTransitLotPayloadFromDraft(
  draft: Ct0BatchDraft,
  totalCopCardsCost: number,
  owner: OwnerKey = OWNERS_CONFIG.defaultOwner,
): CreateTransitLotPayload {
  const hasLegacyBasis =
    draft.legacyBatchId != null &&
    draft.legacyTotalFxCardsCost != null &&
    draft.legacyTotalFxCardsCost > 0;

  return {
    items: draft.lines.map((line) => ({
      card_id: line.tcgdexCardId!,
      card_name: line.name,
      language: line.language,
      quantity: line.qty,
      fx_total_lot: line.usdTotalLot,
      rareza: line.rareza,
      ct0_item_id: line.ct0ItemId,
      product_id: line.productId > 0 ? line.productId : undefined,
      blueprint_id: line.blueprintId,
      expansion: line.expansion,
      collector_number: line.collectorNumber,
    })),
    total_cop_cards_cost: hasLegacyBasis
      ? (draft.legacyCopHint ?? totalCopCardsCost)
      : totalCopCardsCost,
    purchase_date: draft.purchaseDate,
    cards_cost_currency: draft.legacyCardsCostCurrency ?? 'USD',
    source: 'ct0',
    ct0_package_key: draft.packageKey,
    legacy_incoming_batch_id: draft.legacyBatchId ?? undefined,
    legacy_incoming_cop_hint: draft.legacyCopHint ?? undefined,
    legacy_basis_total_fx_cards_cost: hasLegacyBasis
      ? draft.legacyTotalFxCardsCost ?? undefined
      : undefined,
    legacy_basis_total_cop_cards_cost: hasLegacyBasis
      ? (draft.legacyCopHint ?? totalCopCardsCost)
      : undefined,
    legacy_basis_real_fx_rate_cop: hasLegacyBasis
      ? (draft.legacyRealFxRateCop ?? undefined)
      : undefined,
    legacy_basis_cards_cost_currency: hasLegacyBasis
      ? (draft.legacyCardsCostCurrency ?? undefined)
      : undefined,
    owner,
  };
}

/** @deprecated Usar buildTransitLotPayloadFromDraft */
export const buildIncomingBatchPayloadFromDraft = buildTransitLotPayloadFromDraft;

export function parseCopInput(raw: string): number | null {
  const normalized = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
  if (!normalized.trim()) return null;
  const num = parseFloat(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function buildInitialCopByPackageKey(
  drafts: Ct0BatchDraft[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const draft of drafts) {
    if (draft.legacyCopAutoFilled && draft.legacyCopHint != null && draft.legacyCopHint > 0) {
      out[draft.packageKey] = String(Math.round(draft.legacyCopHint));
    }
  }
  return out;
}

export function suggestedCopForDraft(
  draft: Ct0BatchDraft,
  copByPackageKey: Record<string, string>,
): number | null {
  const manual = parseCopInput(copByPackageKey[draft.packageKey] ?? '');
  if (manual != null) return manual;
  if (draft.legacyCopHint != null && draft.legacyCopHint > 0) return draft.legacyCopHint;
  return null;
}
