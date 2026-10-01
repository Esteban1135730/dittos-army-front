import {
  normalizeOperationalRareza,
  operationalRarezaLabel,
} from "../../constants/item-rareza";
import { isStockLineVisibleInGrid } from "../../utils/stock-grid-visible";

/** Estados que el mostrador no ofrece en la búsqueda manual. */
const SELLABLE_STATES = new Set(["disponible", "en_stock_colombia"]);

export type CounterSearchRow = {
  _id: string;
  card_id: string;
  card_name?: string;
  image_url?: string;
  card_state?: string;
  language?: string;
  languaje?: string;
  rareza?: string | null;
  holofoil?: boolean;
  league_card?: boolean;
  product_kind?: string | null;
  quantity?: number | null;
  pvp?: number;
  pvp_currency?: string;
};

export type CounterSearchGroup = {
  key: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  /** Etiqueta visible, alineada con `StockScanView.rareza`. */
  rareza: string | null;
  pvp: number | null;
  pvp_currency: string | null;
  count: number;
  stock_ids: string[];
};

export function effectiveOperationalRareza(row: {
  rareza?: string | null;
  league_card?: boolean;
  holofoil?: boolean;
}): string | null {
  const fromField = normalizeOperationalRareza(row.rareza);
  if (fromField != null) return fromField;
  if (row.league_card) return "league card";
  if (row.holofoil) return "holofoil";
  return null;
}

function displayLanguage(raw: string | null | undefined): string {
  const lang = String(raw ?? "").trim();
  if (!lang) return "";
  return lang.toUpperCase();
}

function rarezaLabel(canonical: string | null): string | null {
  if (!canonical) return null;
  return operationalRarezaLabel(canonical);
}

export function isCounterSearchRowSellable(row: CounterSearchRow): boolean {
  const state = String(row.card_state ?? "").trim();
  if (state === "vendida" || state === "propiedad" || state === "perdida") {
    return false;
  }
  if (!isStockLineVisibleInGrid({ card_state: state })) return false;
  if (!SELLABLE_STATES.has(state)) return false;
  if (String(row.product_kind ?? "").trim() === "quantity") {
    const qty = row.quantity;
    if (qty == null || !Number.isFinite(Number(qty)) || Number(qty) <= 0) {
      return false;
    }
  }
  return true;
}

function rowUnits(row: CounterSearchRow): number {
  if (String(row.product_kind ?? "").trim() === "quantity") {
    const qty = Number(row.quantity);
    return Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  }
  return 1;
}

function rowPrice(row: CounterSearchRow): { pvp: number | null; pvp_currency: string | null } {
  if (row.pvp == null || !(row.pvp > 0)) {
    return { pvp: null, pvp_currency: null };
  }
  const currency = (row.pvp_currency ?? "").trim();
  return { pvp: row.pvp, pvp_currency: currency || "COP" };
}

export function groupCounterSearchRows(
  rows: CounterSearchRow[],
): CounterSearchGroup[] {
  const groups = new Map<string, CounterSearchGroup>();
  for (const row of rows) {
    if (!isCounterSearchRowSellable(row)) continue;
    const cardId = String(row.card_id ?? "").trim();
    const stockId = String(row._id ?? "").trim();
    if (!cardId || !stockId) continue;
    const language = displayLanguage(row.language ?? row.languaje);
    const canonical = effectiveOperationalRareza(row);
    const rareza = rarezaLabel(canonical);
    const price = rowPrice(row);
    const key = `${cardId}|${language}|${canonical ?? ""}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        card_id: cardId,
        card_name: String(row.card_name ?? "").trim(),
        image_url: String(row.image_url ?? ""),
        language,
        rareza,
        pvp: price.pvp,
        pvp_currency: price.pvp_currency,
        count: rowUnits(row),
        stock_ids: [stockId],
      });
      continue;
    }
    existing.count += rowUnits(row);
    existing.stock_ids.push(stockId);
    if (!existing.card_name && row.card_name) {
      existing.card_name = String(row.card_name).trim();
    }
    if (!existing.image_url && row.image_url) {
      existing.image_url = String(row.image_url);
    }
    if (existing.pvp == null && price.pvp != null) {
      existing.pvp = price.pvp;
      existing.pvp_currency = price.pvp_currency;
    }
  }

  const list = [...groups.values()];
  for (const group of list) {
    group.stock_ids.sort((a, b) => a.localeCompare(b));
  }
  list.sort((a, b) =>
    (a.card_name || a.card_id).localeCompare(b.card_name || b.card_id, "es"),
  );
  return list;
}

/** Id a escanear: uno que no esté en el carrito, o el primero si todos lo están. */
export function pickGroupScanStockId(
  stockIds: string[],
  excludeIds: string[],
): string | null {
  if (stockIds.length === 0) return null;
  const excluded = new Set(excludeIds.map((id) => id.trim()).filter(Boolean));
  return stockIds.find((id) => !excluded.has(id)) ?? stockIds[0];
}
