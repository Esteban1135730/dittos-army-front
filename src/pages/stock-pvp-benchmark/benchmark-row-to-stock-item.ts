import type { StockListItem } from "../../types/stock";
import type { StockPvpBenchmarkRow } from "./stock-pvp-benchmark.types";

/** Mínimo para `PvpInlineCell` (POST /pvp del owner activo). */
export function benchmarkRowToStockItem(row: StockPvpBenchmarkRow): StockListItem {
  const pvp = row.pvp_current;
  return {
    _id: row.variant_key,
    card_id: row.card_id,
    card_name: row.card_name,
    image_url: row.image_url,
    shipment: 0,
    unity_cost: 0,
    cards_in_shipmet: 1,
    card_state: "disponible",
    currency: "COP",
    card_cost: row.card_cost_avg ?? 0,
    pvp: pvp != null && pvp > 0 ? pvp : undefined,
    pvp_currency: pvp != null && pvp > 0 ? "COP" : undefined,
    language: row.language,
    rareza: row.rareza,
    holofoil: false,
    league_card: false,
  };
}
