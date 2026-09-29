import type { CtMoney } from './cardtrader-order-pricing';
import { moneyToUnits } from './cardtrader-order-pricing';
import { CARDTRADER_POKEMON_GAME_ID } from '../config/cardtrader-games';

export type Ct0QuantityState = 'ok' | 'pending' | 'missing';

export type Ct0BoxItem = {
  id: number;
  quantity: Partial<Record<Ct0QuantityState, number>>;
  seller?: { id?: number; username?: string };
  product_id: number;
  blueprint_id: number;
  category_id: number;
  game_id: number;
  name: string;
  expansion: string;
  bundle_size?: number;
  description?: string | null;
  graded?: boolean | string;
  properties?: Record<string, unknown>;
  buyer_price?: CtMoney;
  formatted_price?: string;
  paid_at?: string | null;
  estimated_arrived_at?: string | null;
  arrived_at?: string | null;
  cancelled_at?: string | null;
  presale?: boolean | null;
};

export const CT0_BOX_STATE_TABS = [
  { id: 'ok' as const, label: 'Listas para envío', summaryColor: '#2e7d32' },
  { id: 'pending' as const, label: 'En camino al hub', summaryColor: '#1565c0' },
  { id: 'missing' as const, label: 'No disponibles', summaryColor: '#ef6c00' },
  { id: 'all' as const, label: 'Todas', summaryColor: '#546e7a' },
];

export type Ct0BoxStateTab = (typeof CT0_BOX_STATE_TABS)[number]['id'];

/** `null` = no filtrar por juego. Por defecto Pokémon (compat). */
export type Ct0GameIdFilter = number | null;

export function filterCt0ItemsByGameId(
  items: Ct0BoxItem[],
  gameId: Ct0GameIdFilter = CARDTRADER_POKEMON_GAME_ID,
): Ct0BoxItem[] {
  if (gameId == null) return items;
  return items.filter((i) => i.game_id === gameId);
}

/**
 * Resuelve filtro de juego: `gameId` explícito gana;
 * `pokemonOnly: false` → sin filtro; si no → Pokémon.
 */
export function resolveCt0GameIdFilter(args: {
  gameId?: number | null;
  pokemonOnly?: boolean;
}): Ct0GameIdFilter {
  if (args.gameId !== undefined) return args.gameId;
  if (args.pokemonOnly === false) return null;
  return CARDTRADER_POKEMON_GAME_ID;
}

export function ct0ItemQtyForState(item: Ct0BoxItem, state: Ct0QuantityState): number {
  return Math.max(0, Math.floor(item.quantity?.[state] ?? 0));
}

export function ct0ItemActiveStates(item: Ct0BoxItem): Ct0QuantityState[] {
  return (['ok', 'pending', 'missing'] as const).filter((s) => ct0ItemQtyForState(item, s) > 0);
}

export function ct0LineWeight(item: Ct0BoxItem, state: Ct0QuantityState): number {
  const qty = ct0ItemQtyForState(item, state);
  if (qty <= 0) return 0;
  return moneyToUnits(item.buyer_price) * qty;
}

export function ct0ItemLineWeight(item: Ct0BoxItem, state: Ct0QuantityState): number {
  return ct0LineWeight(item, state);
}

export function ct0ItemUnitsForTab(item: Ct0BoxItem, tab: Ct0BoxStateTab): number {
  if (tab === 'all') {
    return (
      ct0ItemQtyForState(item, 'ok') +
      ct0ItemQtyForState(item, 'pending') +
      ct0ItemQtyForState(item, 'missing')
    );
  }
  return ct0ItemQtyForState(item, tab);
}

export function ct0ItemLineUsdForTab(item: Ct0BoxItem, tab: Ct0BoxStateTab): number {
  if (tab === 'all') {
    return (
      ct0LineWeight(item, 'ok') +
      ct0LineWeight(item, 'pending') +
      ct0LineWeight(item, 'missing')
    );
  }
  return ct0LineWeight(item, tab);
}

/** Unidades en tránsito CT Zero (listas + en camino al hub, sin missing). */
export function ct0ItemUnitsInTransit(item: Ct0BoxItem): number {
  return ct0ItemQtyForState(item, 'ok') + ct0ItemQtyForState(item, 'pending');
}

/** Carta CT0 a precio $0 con unidades en tránsito (regalo / reemplazo). */
export function isCt0ComplementItem(item: Ct0BoxItem): boolean {
  const cents = item.buyer_price?.cents;
  if (cents !== 0) return false;
  return ct0ItemUnitsInTransit(item) > 0;
}

export function filterCt0ComplementItems(
  items: Ct0BoxItem[],
  gameId: Ct0GameIdFilter = CARDTRADER_POKEMON_GAME_ID,
): Ct0BoxItem[] {
  return filterCt0ItemsByGameId(items, gameId).filter(isCt0ComplementItem);
}

/** Ítem CT0 marcado como no disponible / no llegará. */
export function isCt0MissingItem(item: Ct0BoxItem): boolean {
  return ct0ItemQtyForState(item, 'missing') > 0;
}

export function filterCt0MissingItems(
  items: Ct0BoxItem[],
  gameId: Ct0GameIdFilter = CARDTRADER_POKEMON_GAME_ID,
): Ct0BoxItem[] {
  return filterCt0ItemsByGameId(items, gameId).filter(isCt0MissingItem);
}

export type TransitLineCt0Ref = {
  line_id: string;
  ct0_item_id: number | null;
  not_arrived_at?: string | Date | null;
};

/** Cruza missing CT0 con líneas de tránsito solo por ct0_item_id. */
export function matchMissingToTransitLines(
  missingItems: Ct0BoxItem[],
  transitLines: TransitLineCt0Ref[],
): Array<{
  item: Ct0BoxItem;
  transit_line_id: string | null;
  already_marked: boolean;
}> {
  const byCt0 = new Map<number, TransitLineCt0Ref>();
  for (const line of transitLines) {
    const id = line.ct0_item_id;
    if (id == null || !Number.isInteger(id) || id <= 0) continue;
    if (!byCt0.has(id)) byCt0.set(id, line);
  }
  return missingItems.map((item) => {
    const line = byCt0.get(item.id);
    return {
      item,
      transit_line_id: line?.line_id ?? null,
      already_marked: Boolean(line?.not_arrived_at),
    };
  });
}

/** Clave anti-duplicado estable para un lote de complementos. */
export function buildComplementosPackageKey(ct0ItemIds: number[]): string {
  const ids = [...new Set(ct0ItemIds.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (a, b) => a - b,
  );
  return `complementos:${ids.join('-') || 'empty'}`;
}

/** Todas las unidades en CT Zero (ok + pending + missing). */
export function ct0ItemUnitsAll(item: Ct0BoxItem): number {
  return (
    ct0ItemQtyForState(item, 'ok') +
    ct0ItemQtyForState(item, 'pending') +
    ct0ItemQtyForState(item, 'missing')
  );
}

export function filterCt0ItemsAll(
  items: Ct0BoxItem[],
  gameId: Ct0GameIdFilter = CARDTRADER_POKEMON_GAME_ID,
): Ct0BoxItem[] {
  return filterCt0ItemsByGameId(items, gameId).filter(
    (item) => ct0ItemUnitsAll(item) > 0,
  );
}

export function ct0ItemLineUsdInTransit(item: Ct0BoxItem): number {
  return ct0LineWeight(item, 'ok') + ct0LineWeight(item, 'pending');
}

export function filterCt0ItemsInTransit(
  items: Ct0BoxItem[],
  gameId: Ct0GameIdFilter = CARDTRADER_POKEMON_GAME_ID,
): Ct0BoxItem[] {
  return filterCt0ItemsByGameId(items, gameId).filter(
    (item) => ct0ItemUnitsInTransit(item) > 0,
  );
}

/** Agrupa checkouts CT Zero con cartas en tránsito (ok + pending). */
export function groupCt0ItemsIntoTransitLots(
  items: Ct0BoxItem[],
  gameId: Ct0GameIdFilter = CARDTRADER_POKEMON_GAME_ID,
): Ct0PurchaseLot[] {
  const map = new Map<string, Ct0BoxItem[]>();
  for (const item of filterCt0ItemsInTransit(items, gameId)) {
    const key = ct0LotKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const lots: Ct0PurchaseLot[] = [];
  for (const [lotKey, lotItems] of map) {
    let units = 0;
    let ctSubtotalUsd = 0;
    for (const item of lotItems) {
      units += ct0ItemUnitsInTransit(item);
      ctSubtotalUsd += ct0ItemLineUsdInTransit(item);
    }
    lots.push({
      lotKey,
      paidAt: lotItems[0]?.paid_at ?? null,
      items: lotItems,
      units,
      ctSubtotalUsd,
      productLines: lotItems.length,
    });
  }

  lots.sort((a, b) => {
    const ta = a.paidAt ? Date.parse(a.paidAt) : 0;
    const tb = b.paidAt ? Date.parse(b.paidAt) : 0;
    return tb - ta;
  });
  return lots;
}

export function allocateCt0CopInTransit(
  items: Ct0BoxItem[],
  totalCopPaid: number,
): Ct0CopAllocationResult {
  const weights = items.map((item) => ct0ItemLineUsdInTransit(item));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (!Number.isFinite(totalCopPaid) || totalCopPaid <= 0 || totalWeight <= 0) {
    return {
      lines: items.map((item) => ({
        itemId: item.id,
        quantity: ct0ItemUnitsInTransit(item) || 1,
        weightShare: 0,
        lineCop: 0,
        unitCop: 0,
      })),
      totalCopPaid: Math.max(0, totalCopPaid),
      totalWeightUsd: totalWeight,
      implicitRateCopPerUsd: null,
    };
  }

  const lines = items.map((item, idx) => {
    const qty = Math.max(1, ct0ItemUnitsInTransit(item));
    const share = weights[idx] / totalWeight;
    const lineCop = totalCopPaid * share;
    return {
      itemId: item.id,
      quantity: qty,
      weightShare: share,
      lineCop,
      unitCop: lineCop / qty,
    };
  });

  return {
    lines,
    totalCopPaid,
    totalWeightUsd: totalWeight,
    implicitRateCopPerUsd: totalCopPaid / totalWeight,
  };
}

export function ct0LotKey(item: Ct0BoxItem): string {
  return item.paid_at ?? `sin-fecha-${item.id}`;
}

export type Ct0PurchaseLot = {
  lotKey: string;
  paidAt: string | null;
  items: Ct0BoxItem[];
  units: number;
  ctSubtotalUsd: number;
  productLines: number;
};

/** Agrupa ítems CT Zero por checkout (`paid_at` = mismo lote / transaction summary). */
export function groupCt0ItemsIntoLots(
  items: Ct0BoxItem[],
  tab: Ct0BoxStateTab,
): Ct0PurchaseLot[] {
  const map = new Map<string, Ct0BoxItem[]>();
  for (const item of items) {
    if (ct0ItemUnitsForTab(item, tab) <= 0) continue;
    const key = ct0LotKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const lots: Ct0PurchaseLot[] = [];
  for (const [lotKey, lotItems] of map) {
    let units = 0;
    let ctSubtotalUsd = 0;
    for (const item of lotItems) {
      units += ct0ItemUnitsForTab(item, tab);
      ctSubtotalUsd += ct0ItemLineUsdForTab(item, tab);
    }
    lots.push({
      lotKey,
      paidAt: lotItems[0]?.paid_at ?? null,
      items: lotItems,
      units,
      ctSubtotalUsd,
      productLines: lotItems.length,
    });
  }

  lots.sort((a, b) => {
    const ta = a.paidAt ? Date.parse(a.paidAt) : 0;
    const tb = b.paidAt ? Date.parse(b.paidAt) : 0;
    return tb - ta;
  });
  return lots;
}

export function filterCt0BoxItems(
  items: Ct0BoxItem[],
  tab: Ct0BoxStateTab,
  gameId: Ct0GameIdFilter = CARDTRADER_POKEMON_GAME_ID,
): Ct0BoxItem[] {
  let rows = filterCt0ItemsByGameId(items, gameId);
  if (tab === 'all') return rows;
  return rows.filter((item) => ct0ItemQtyForState(item, tab) > 0);
}

export type Ct0BoxSummary = {
  units: number;
  totalUsd: number;
  itemLines: number;
};

export function summarizeCt0BoxItems(items: Ct0BoxItem[], state: Ct0QuantityState): Ct0BoxSummary {
  let units = 0;
  let totalUsd = 0;
  let itemLines = 0;
  for (const item of items) {
    const qty = ct0ItemQtyForState(item, state);
    if (qty <= 0) continue;
    itemLines += 1;
    units += qty;
    totalUsd += moneyToUnits(item.buyer_price) * qty;
  }
  return { units, totalUsd, itemLines };
}

export type Ct0CopAllocationLine = {
  itemId: number;
  quantity: number;
  weightShare: number;
  lineCop: number;
  unitCop: number;
};

export type Ct0CopAllocationResult = {
  lines: Ct0CopAllocationLine[];
  totalCopPaid: number;
  totalWeightUsd: number;
  implicitRateCopPerUsd: number | null;
};

/** Reparte COP real del lote entre sus líneas, proporcional a precio CT × qty. */
export function allocateCt0CopToItems(
  items: Ct0BoxItem[],
  tab: Ct0BoxStateTab,
  totalCopPaid: number,
): Ct0CopAllocationResult {
  const weights = items.map((item) => ct0ItemLineUsdForTab(item, tab));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (!Number.isFinite(totalCopPaid) || totalCopPaid <= 0 || totalWeight <= 0) {
    return {
      lines: items.map((item) => ({
        itemId: item.id,
        quantity: ct0ItemUnitsForTab(item, tab) || 1,
        weightShare: 0,
        lineCop: 0,
        unitCop: 0,
      })),
      totalCopPaid: Math.max(0, totalCopPaid),
      totalWeightUsd: totalWeight,
      implicitRateCopPerUsd: null,
    };
  }

  const lines = items.map((item, idx) => {
    const qty = Math.max(1, ct0ItemUnitsForTab(item, tab));
    const share = weights[idx] / totalWeight;
    const lineCop = totalCopPaid * share;
    return {
      itemId: item.id,
      quantity: qty,
      weightShare: share,
      lineCop,
      unitCop: lineCop / qty,
    };
  });

  return {
    lines,
    totalCopPaid,
    totalWeightUsd: totalWeight,
    implicitRateCopPerUsd: totalCopPaid / totalWeight,
  };
}
