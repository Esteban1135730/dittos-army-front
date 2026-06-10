export type CtMoney = {
  cents: number;
  currency: string;
};

export type CtOrderItem = {
  id: number;
  product_id: number;
  blueprint_id: number;
  category_id: number;
  game_id: number;
  name: string;
  expansion: string;
  quantity: number;
  bundle_size?: number;
  description?: string | null;
  properties?: Record<string, unknown>;
  buyer_price?: CtMoney;
  seller_price?: CtMoney;
  formatted_price?: string;
  created_at?: string;
};

export type CtOrder = {
  id: number;
  code: string;
  state: string;
  order_as: string;
  size: number;
  via_cardtrader_zero?: boolean;
  paid_at?: string | null;
  sent_at?: string | null;
  buyer_total?: CtMoney;
  buyer_subtotal?: CtMoney;
  formatted_total?: string;
  formatted_subtotal?: string;
  order_items?: CtOrderItem[];
};

export const CARDTRADER_ORDER_STATES = [
  { id: 'all', label: 'Todos' },
  { id: 'paid', label: 'Paid' },
  { id: 'sent', label: 'Sent' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'done', label: 'Done' },
  { id: 'hub_pending', label: 'Hub pending' },
  { id: 'closed', label: 'Closed' },
  { id: 'canceled', label: 'Canceled' },
  { id: 'request_for_cancel', label: 'Cancel requested' },
  { id: 'lost', label: 'Lost' },
] as const;

export type CardtraderOrderStateTab = (typeof CARDTRADER_ORDER_STATES)[number]['id'];

export function moneyToUnits(m: CtMoney | undefined | null): number {
  if (!m || typeof m.cents !== 'number') return 0;
  return m.cents / 100;
}

export function formatMoney(m: CtMoney | undefined | null): string {
  if (!m) return '—';
  const units = moneyToUnits(m);
  return `${units.toFixed(2)} ${m.currency}`;
}

export function orderItemLineWeight(item: CtOrderItem): number {
  const unit = moneyToUnits(item.buyer_price ?? item.seller_price);
  const qty = Math.max(0, Math.floor(item.quantity ?? 0));
  return unit * qty;
}

export function orderItemsTotalWeight(items: CtOrderItem[]): number {
  return items.reduce((sum, item) => sum + orderItemLineWeight(item), 0);
}

export function orderBuyerTotalUnits(order: CtOrder): number {
  const fromTotal = moneyToUnits(order.buyer_total);
  if (fromTotal > 0) return fromTotal;
  return orderItemsTotalWeight(order.order_items ?? []);
}

export function orderBuyerCurrency(order: CtOrder): string {
  return order.buyer_total?.currency ?? order.order_items?.[0]?.buyer_price?.currency ?? 'EUR';
}

export type OrderCopAllocationLine = {
  itemId: number;
  quantity: number;
  weightShare: number;
  lineCop: number;
  unitCop: number;
};

export type OrderCopAllocationResult = {
  lines: OrderCopAllocationLine[];
  totalCopPaid: number;
  orderWeightUnits: number;
  implicitRateCopPerUnit: number | null;
  buyerCurrency: string;
};

/** Reparte el COP real pagado proporcional al peso buyer_price × qty de cada línea. */
export function allocateOrderCopToItems(
  items: CtOrderItem[],
  totalCopPaid: number,
): OrderCopAllocationResult {
  const weights = items.map(orderItemLineWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const buyerCurrency =
    items[0]?.buyer_price?.currency ?? items[0]?.seller_price?.currency ?? 'EUR';

  if (!Number.isFinite(totalCopPaid) || totalCopPaid <= 0 || totalWeight <= 0) {
    return {
      lines: items.map((item) => ({
        itemId: item.id,
        quantity: Math.max(1, Math.floor(item.quantity ?? 1)),
        weightShare: 0,
        lineCop: 0,
        unitCop: 0,
      })),
      totalCopPaid: Math.max(0, totalCopPaid),
      orderWeightUnits: totalWeight,
      implicitRateCopPerUnit: null,
      buyerCurrency,
    };
  }

  const lines: OrderCopAllocationLine[] = items.map((item, idx) => {
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    const share = weights[idx] / totalWeight;
    const lineCop = totalCopPaid * share;
    const unitCop = lineCop / qty;
    return {
      itemId: item.id,
      quantity: qty,
      weightShare: share,
      lineCop,
      unitCop,
    };
  });

  return {
    lines,
    totalCopPaid,
    orderWeightUnits: totalWeight,
    implicitRateCopPerUnit: totalCopPaid / totalWeight,
    buyerCurrency,
  };
}

export function formatCop(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatRateCopPerUnit(
  rate: number | null,
  currency: string,
): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${Math.round(rate).toLocaleString('es-CO')} COP / ${currency}`;
}
