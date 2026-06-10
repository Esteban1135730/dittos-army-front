import type { Ct0BoxItem, Ct0CopAllocationResult } from './cardtrader-ct0-box';
import {
  allocateCt0CopInTransit,
  ct0ItemQtyForState,
  filterCt0ItemsInTransit,
} from './cardtrader-ct0-box';
import type { IncomingHomologItem } from './incoming-ct0-homolog';
import { findBatchItemForCtLineName } from './incoming-ct0-homolog';
import { moneyToUnits } from './cardtrader-order-pricing';

export type CardLocation = 'ct0-hub' | 'ct0-ready';

export type PurchasePackageLine = {
  lineKey: string;
  location: CardLocation;
  name: string;
  qty: number;
  language: string;
  condition: string;
  variantLabel: string;
  referencePrice: string;
  referenceUsd: number;
  unitCostCop: number | null;
  lineCostCop: number | null;
  expansion: string;
  ct0ItemId: number;
  blueprintId: number;
};

export type PurchasePackage = {
  packageKey: string;
  paidAt: string;
  paidAtLabel: string;
  ctSubtotalUsd: number;
  units: number;
  lineCount: number;
  locations: CardLocation[];
  lines: PurchasePackageLine[];
};

export type PurchaseConsolidatedSummary = {
  packageCount: number;
  totalUnits: number;
  ct0HubUnits: number;
  ct0ReadyUnits: number;
  ctSubtotalUsd: number;
};

function formatPaidAtLabel(paidAt: string): string {
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return paidAt;
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function ct0LineUsd(item: Ct0BoxItem, location: CardLocation): number {
  const qty = ct0ItemQtyForState(item, location === 'ct0-ready' ? 'ok' : 'pending');
  return qty * moneyToUnits(item.buyer_price);
}

function pushLocation(pkg: PurchasePackage, loc: CardLocation): void {
  if (!pkg.locations.includes(loc)) pkg.locations.push(loc);
}

function applyCopAllocationToPackageLines(
  lines: PurchasePackageLine[],
  totalCop: number,
): void {
  const weights = lines.map((l) => l.referenceUsd);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const share = weights[i]! / totalWeight;
    const lineCop = totalCop * share;
    line.lineCostCop = lineCop;
    line.unitCostCop = lineCop / line.qty;
  }
}

function applyIncomingBatchUnitCostsToLines(
  lines: PurchasePackageLine[],
  batchItems: IncomingHomologItem[],
): number {
  let total = 0;
  for (const line of lines) {
    const item = findBatchItemForCtLineName(line.name, line.language, batchItems);
    const unit = item?.unit_cost_cop;
    if (unit != null && unit > 0) {
      line.unitCostCop = unit;
      line.lineCostCop = unit * line.qty;
      total += line.lineCostCop;
    }
  }
  return total;
}

/** CT Zero en tránsito (ok + pending), agrupado por `paid_at`. */
export function buildPurchasePackages(args: {
  ct0Items: Ct0BoxItem[];
  copByPackageKey: Record<string, string>;
  /** Lote panel emparejado → ítems con unit_cost_cop para autocompletar COP por línea. */
  batchItemsByPackageKey?: Record<string, IncomingHomologItem[]>;
  parseCop: (raw: string) => number | null;
  readCondition: (props: Record<string, unknown> | undefined) => string;
  readLanguage: (props: Record<string, unknown> | undefined) => string;
  variantLabel: (props: Record<string, unknown> | undefined) => string;
  pokemonOnly?: boolean;
}): { packages: PurchasePackage[]; summary: PurchaseConsolidatedSummary } {
  const pokemonOnly = args.pokemonOnly !== false;
  const packageMap = new Map<string, PurchasePackage>();

  for (const item of filterCt0ItemsInTransit(args.ct0Items, pokemonOnly)) {
    const paidAt = item.paid_at;
    if (!paidAt) continue;

    let pkg = packageMap.get(paidAt);
    if (!pkg) {
      pkg = {
        packageKey: paidAt,
        paidAt,
        paidAtLabel: formatPaidAtLabel(paidAt),
        ctSubtotalUsd: 0,
        units: 0,
        lineCount: 0,
        locations: [],
        lines: [],
      };
      packageMap.set(paidAt, pkg);
    }

    const addLine = (location: CardLocation) => {
      const qty = ct0ItemQtyForState(item, location === 'ct0-ready' ? 'ok' : 'pending');
      if (qty <= 0) return;
      const usd = ct0LineUsd(item, location);
      pkg!.lines.push({
        lineKey: `ct0-${item.id}-${location}`,
        location,
        name: item.name,
        qty,
        language: args.readLanguage(item.properties),
        condition: args.readCondition(item.properties),
        variantLabel: args.variantLabel(item.properties),
        referencePrice: `$${usd.toFixed(2)}`,
        referenceUsd: usd,
        unitCostCop: null,
        lineCostCop: null,
        expansion: item.expansion,
        ct0ItemId: item.id,
        blueprintId: item.blueprint_id,
      });
      pushLocation(pkg!, location);
    };

    addLine('ct0-hub');
    addLine('ct0-ready');
  }

  const packages: PurchasePackage[] = [];

  for (const pkg of packageMap.values()) {
    if (pkg.lines.length === 0) continue;

    pkg.ctSubtotalUsd = pkg.lines.reduce((s, l) => s + l.referenceUsd, 0);
    pkg.units = pkg.lines.reduce((s, l) => s + l.qty, 0);
    pkg.lineCount = pkg.lines.length;

    const batchItems = args.batchItemsByPackageKey?.[pkg.packageKey];
    let batchCopSum = 0;
    if (batchItems?.length) {
      batchCopSum = applyIncomingBatchUnitCostsToLines(pkg.lines, batchItems);
    }

    const copRaw = args.copByPackageKey[pkg.packageKey] ?? '';
    let copPaid = args.parseCop(copRaw);
    if (copPaid == null && batchCopSum > 0) {
      copPaid = batchCopSum;
    }

    if (copPaid != null && pkg.ctSubtotalUsd > 0) {
      const unpriced = pkg.lines.filter((l) => l.unitCostCop == null);
      if (unpriced.length === pkg.lines.length) {
        applyCopAllocationToPackageLines(pkg.lines, copPaid);
      } else if (unpriced.length > 0) {
        const pricedCop = pkg.lines.reduce((s, l) => s + (l.lineCostCop ?? 0), 0);
        const remaining = copPaid - pricedCop;
        if (remaining > 0) {
          applyCopAllocationToPackageLines(unpriced, remaining);
        }
      }
    }

    packages.push(pkg);
  }

  packages.sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt));

  const summary: PurchaseConsolidatedSummary = {
    packageCount: packages.length,
    totalUnits: packages.reduce((s, p) => s + p.units, 0),
    ct0HubUnits: packages.reduce(
      (s, p) => s + p.lines.filter((l) => l.location === 'ct0-hub').reduce((a, l) => a + l.qty, 0),
      0,
    ),
    ct0ReadyUnits: packages.reduce(
      (s, p) => s + p.lines.filter((l) => l.location === 'ct0-ready').reduce((a, l) => a + l.qty, 0),
      0,
    ),
    ctSubtotalUsd: packages.reduce((s, p) => s + p.ctSubtotalUsd, 0),
  };

  return { packages, summary };
}

export function allocateCopToCt0PackageItems(
  items: Ct0BoxItem[],
  totalCopPaid: number,
): Ct0CopAllocationResult {
  return allocateCt0CopInTransit(items, totalCopPaid);
}

export function locationLabel(loc: CardLocation): string {
  switch (loc) {
    case 'ct0-hub':
      return 'CT Zero · en hub';
    case 'ct0-ready':
      return 'CT Zero · listas';
    default:
      return loc;
  }
}
