import type { CtOrder, CtOrderItem } from './cardtrader-order-pricing';
import { moneyToUnits } from './cardtrader-order-pricing';
import { readCtLanguage } from './cardtrader-order-item-map';
import type { Ct0HomologIndex } from './incoming-ct0-homolog';
import { incomingNameMatchKey, normalizeMatchLanguage } from './incoming-ct0-homolog';
import { normalizeCardNameForMatch } from './incoming-ct0-package-match';
import type { Ct0PackageProfile } from './incoming-ct0-package-match';
import { startOfUtcDayMs } from './incoming-ct0-package-match';

/** Pedidos en camino vía API (aún no recibidos en CT Zero). */
export const IN_TRANSIT_ORDER_STATES = new Set(['paid', 'sent', 'done']);

export type OrderTransitLine = {
  lineKey: string;
  orderId: number;
  orderCode: string;
  orderState: string;
  paidAt: string;
  name: string;
  qty: number;
  language: string;
  expansion: string;
  referencePrice: string;
  unitPrice: number;
  priceCurrency: string;
  /** Precio unitario en EUR cuando la moneda del pedido es EUR (para match con panel). */
  unitPriceEur: number | null;
  blueprintId: number;
};

export type OrderTransitPackage = {
  packageKey: string;
  paidAt: string;
  paidAtLabel: string;
  orderId: number;
  orderCode: string;
  orderState: string;
  units: number;
  lines: OrderTransitLine[];
};

function formatPaidAtLabel(paidAt: string): string {
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return paidAt;
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function orderLineUnitPrice(item: CtOrderItem): {
  amount: number;
  currency: string;
  eur: number | null;
} {
  const money = item.buyer_price ?? item.seller_price;
  if (!money || typeof money.cents !== 'number') {
    return { amount: 0, currency: 'EUR', eur: null };
  }
  const amount = moneyToUnits(money);
  const currency = money.currency ?? 'EUR';
  const eur = currency === 'EUR' ? amount : null;
  return { amount, currency, eur };
}

function lineReferencePrice(item: CtOrderItem): string {
  const { amount, currency } = orderLineUnitPrice(item);
  if (amount <= 0) return '—';
  return `${amount.toFixed(2)} ${currency}`;
}

export function normalizeCtOrdersResponse(raw: unknown): CtOrder[] {
  if (Array.isArray(raw)) return raw as CtOrder[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { data?: unknown; orders?: unknown };
    if (Array.isArray(obj.data)) return obj.data as CtOrder[];
    if (Array.isArray(obj.orders)) return obj.orders as CtOrder[];
  }
  return [];
}

export function filterInTransitOrders(orders: CtOrder[]): CtOrder[] {
  return orders.filter((o) => IN_TRANSIT_ORDER_STATES.has(String(o.state ?? '').toLowerCase()));
}

/** @deprecated use filterInTransitOrders */
export function filterPaidSentOrders(orders: CtOrder[]): CtOrder[] {
  return filterInTransitOrders(orders);
}

export function buildOrderTransitPackages(orders: CtOrder[]): OrderTransitPackage[] {
  const packages: OrderTransitPackage[] = [];

  for (const order of filterInTransitOrders(orders)) {
    const items = order.order_items ?? [];
    if (items.length === 0) continue;
    const paidAt =
      order.paid_at ?? order.sent_at ?? order.order_items?.[0]?.created_at ?? String(order.id);
    const lines: OrderTransitLine[] = items.map((item) => {
      const price = orderLineUnitPrice(item);
      return {
        lineKey: `order-${order.id}-${item.id}`,
        orderId: order.id,
        orderCode: order.code,
        orderState: order.state,
        paidAt,
        name: item.name,
        qty: Math.max(1, Math.floor(item.quantity ?? 1)),
        language: readCtLanguage(item.properties),
        expansion: item.expansion ?? '',
        referencePrice: lineReferencePrice(item),
        unitPrice: price.amount,
        priceCurrency: price.currency,
        unitPriceEur: price.eur,
        blueprintId: item.blueprint_id,
      };
    });

    packages.push({
      packageKey: `order-${order.id}`,
      paidAt,
      paidAtLabel: formatPaidAtLabel(paidAt),
      orderId: order.id,
      orderCode: order.code,
      orderState: order.state,
      units: lines.reduce((s, l) => s + l.qty, 0),
      lines,
    });
  }

  packages.sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt));
  return packages;
}

/** Quita unidades ya cubiertas en CT Zero — solo queda lo “en camino” vía API. */
export function filterOrderPackagesExcludingCt0(
  packages: OrderTransitPackage[],
  ct0Index: Ct0HomologIndex,
): OrderTransitPackage[] {
  const byName = new Map<string, number>();
  const byNameOnly = new Map<string, number>();
  for (const [key, bucket] of ct0Index.byName) {
    byName.set(key, bucket.totalQty);
  }
  for (const [key, bucket] of ct0Index.byNameOnly) {
    byNameOnly.set(key, bucket.totalQty);
  }

  const takeCt0 = (name: string, language: string, qty: number): number => {
    const langKey = incomingNameMatchKey(name, normalizeMatchLanguage(language));
    const nameKey = normalizeCardNameForMatch(name);

    let taken = Math.min(byName.get(langKey) ?? 0, qty);
    if (taken > 0) {
      byName.set(langKey, (byName.get(langKey) ?? 0) - taken);
      byNameOnly.set(nameKey, (byNameOnly.get(nameKey) ?? 0) - taken);
      return taken;
    }

    taken = Math.min(byNameOnly.get(nameKey) ?? 0, qty);
    if (taken > 0) {
      byNameOnly.set(nameKey, (byNameOnly.get(nameKey) ?? 0) - taken);
      for (const [key, n] of [...byName.entries()]) {
        if (!key.startsWith(`${nameKey}|`) || n <= 0) continue;
        const share = Math.min(n, taken);
        byName.set(key, n - share);
        break;
      }
    }
    return taken;
  };

  const out: OrderTransitPackage[] = [];
  for (const pkg of packages) {
    const lines: OrderTransitLine[] = [];
    for (const line of pkg.lines) {
      const covered = takeCt0(line.name, line.language, line.qty);
      const remaining = line.qty - covered;
      if (remaining > 0) lines.push({ ...line, qty: remaining });
    }
    if (lines.length > 0) {
      out.push({
        ...pkg,
        lines,
        units: lines.reduce((s, l) => s + l.qty, 0),
      });
    }
  }
  return out;
}

export function buildOrderPackageProfile(pkg: OrderTransitPackage): Ct0PackageProfile {
  const nameCounts = new Map<string, number>();
  for (const line of pkg.lines) {
    const key = line.name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key || line.qty <= 0) continue;
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + line.qty);
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

export function flattenOrderTransitLines(packages: OrderTransitPackage[]): OrderTransitLine[] {
  return packages.flatMap((p) => p.lines);
}
