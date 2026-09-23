import type { CardtraderTransitCatalogLine } from "./cardtrader-transit-types";

export type TransitCatalogLotSlice = {
  transit_line_id: string;
  transit_lot_id: string;
  remaining_quantity: number;
  unit_cost_cop: number;
  purchase_date: string;
  owner: string;
  expansion: string | null;
  collector_number: string | null;
  rareza: string | null;
};

export type TransitCatalogCardGroup = {
  key: string;
  card_id: string;
  language: string;
  card_name: string;
  image_url: string;
  expansion: string | null;
  collector_number: string | null;
  rareza: string | null;
  remaining_quantity: number;
  /** Promedio ponderado por qty restante. */
  unit_cost_cop: number;
  total_cost_cop: number;
  lots: TransitCatalogLotSlice[];
};

export function transitCatalogGroupKey(cardId: string, language: string): string {
  return `${cardId}::${language}`;
}

const LOCALE_ES = "es";

export function groupTransitCatalogByCard(
  lines: CardtraderTransitCatalogLine[],
): TransitCatalogCardGroup[] {
  const map = new Map<string, TransitCatalogCardGroup>();

  for (const line of lines) {
    if ((line.remaining_quantity ?? 0) <= 0) continue;
    const key = transitCatalogGroupKey(line.card_id, line.language);
    const qty = line.remaining_quantity;
    const unit = line.unit_cost_cop ?? 0;
    const slice: TransitCatalogLotSlice = {
      transit_line_id: line.transit_line_id,
      transit_lot_id: line.transit_lot_id,
      remaining_quantity: qty,
      unit_cost_cop: unit,
      purchase_date: line.purchase_date,
      owner: String(line.owner ?? "pablo"),
      expansion: line.expansion ?? null,
      collector_number: line.collector_number ?? null,
      rareza: line.rareza ?? null,
    };

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        card_id: line.card_id,
        language: line.language,
        card_name: line.card_name || line.card_id,
        image_url: line.image_url ?? "",
        expansion: line.expansion ?? null,
        collector_number: line.collector_number ?? null,
        rareza: line.rareza ?? null,
        remaining_quantity: qty,
        unit_cost_cop: unit,
        total_cost_cop: unit * qty,
        lots: [slice],
      });
      continue;
    }

    existing.remaining_quantity += qty;
    existing.total_cost_cop += unit * qty;
    existing.unit_cost_cop =
      existing.remaining_quantity > 0
        ? existing.total_cost_cop / existing.remaining_quantity
        : 0;
    existing.lots.push(slice);
    if (!existing.image_url && line.image_url) {
      existing.image_url = line.image_url;
    }
    if (!existing.expansion && line.expansion) {
      existing.expansion = line.expansion;
    }
    if (!existing.collector_number && line.collector_number) {
      existing.collector_number = line.collector_number;
    }
    if (!existing.rareza && line.rareza) {
      existing.rareza = line.rareza;
    }
  }

  return [...map.values()].sort((a, b) => {
    const byName = a.card_name.localeCompare(b.card_name, LOCALE_ES, {
      sensitivity: "base",
    });
    if (byName !== 0) return byName;
    const byLang = a.language.localeCompare(b.language, LOCALE_ES, {
      sensitivity: "base",
    });
    if (byLang !== 0) return byLang;
    return a.card_id.localeCompare(b.card_id);
  });
}

export type TransitCatalogFilters = {
  text: string;
  language: string;
  rareza: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function filterTransitCatalogGroups(
  groups: TransitCatalogCardGroup[],
  filters: TransitCatalogFilters,
): TransitCatalogCardGroup[] {
  const text = normalize(filters.text);
  const language = normalize(filters.language);
  const rareza = normalize(filters.rareza);

  return groups.filter((g) => {
    if (language && normalize(g.language) !== language) return false;
    if (rareza) {
      const gRare = normalize(g.rareza ?? "");
      if (!gRare || gRare !== rareza) return false;
    }
    if (!text) return true;
    const haystack = [
      g.card_name,
      g.card_id,
      g.expansion ?? "",
      g.collector_number ?? "",
      g.language,
      g.rareza ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(text);
  });
}

export function uniqueLanguagesFromGroups(groups: TransitCatalogCardGroup[]): string[] {
  const set = new Set<string>();
  for (const g of groups) {
    if (g.language?.trim()) set.add(g.language.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, LOCALE_ES, { sensitivity: "base" }));
}

export function uniqueRarezasFromGroups(groups: TransitCatalogCardGroup[]): string[] {
  const set = new Set<string>();
  for (const g of groups) {
    const r = g.rareza?.trim();
    if (r) set.add(r);
  }
  return [...set].sort((a, b) => a.localeCompare(b, LOCALE_ES, { sensitivity: "base" }));
}

export function totalRemainingQty(groups: TransitCatalogCardGroup[]): number {
  return groups.reduce((sum, g) => sum + g.remaining_quantity, 0);
}

export function totalCostCop(groups: TransitCatalogCardGroup[]): number {
  return groups.reduce((sum, g) => sum + g.total_cost_cop, 0);
}
