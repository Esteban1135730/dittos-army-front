import type { PanelHomologItem, SentHomologUnit } from '../../utils/sent-unit-homolog';
import { fxUnitPriceFromSentUnit } from '../../utils/purchase-currency';

export function normalizeHomologSearchQuery(query: string | null | undefined): string {
  return String(query ?? '').trim().toLowerCase();
}

function joinSearchParts(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((p) => p != null && String(p).trim() !== '')
    .join(' ')
    .toLowerCase();
}

export function buildSentUnitSearchHaystack(unit: SentHomologUnit): string {
  const { amount, currency } = fxUnitPriceFromSentUnit(unit);
  return joinSearchParts([
    unit.name,
    unit.expansion,
    unit.order_code,
    unit.order_id,
    unit.language,
    unit.rareza,
    unit.status,
    unit.batch_item_card_name,
    unit.sent_unit_key,
    amount,
    currency,
    unit.paid_at,
  ]);
}

export function buildPanelItemSearchHaystack(item: PanelHomologItem): string {
  return joinSearchParts([
    item.card_name,
    item.card_id,
    item.language,
    item.rareza,
    item.batch_id,
    item.batch_purchase_date,
    item.eur_unit_price,
    item.eur_total_lot,
    item.unit_cost_cop,
    item.cards_cost_currency,
    item.remaining_quantity,
    item.available_in_session,
  ]);
}

export function matchesHomologHaystack(
  haystack: string,
  query: string | null | undefined,
): boolean {
  const q = normalizeHomologSearchQuery(query);
  if (!q) return true;
  const tokens = q.split(/\s+/).filter((token) => token.length > 0);
  return tokens.every((token) => haystack.includes(token));
}

/** @deprecated Usar haystack precalculado + matchesHomologHaystack */
export function matchesHomologSearch(
  query: string | null | undefined,
  parts: Array<string | number | null | undefined>,
): boolean {
  return matchesHomologHaystack(joinSearchParts(parts), query);
}

export function filterByHomologSearch<T>(
  items: T[],
  haystackByItem: (item: T) => string,
  query: string | null | undefined,
): T[] {
  const q = normalizeHomologSearchQuery(query);
  if (!q) return items;
  const tokens = q.split(/\s+/).filter((token) => token.length > 0);
  return items.filter((item) => {
    const haystack = haystackByItem(item);
    return tokens.every((token) => haystack.includes(token));
  });
}
