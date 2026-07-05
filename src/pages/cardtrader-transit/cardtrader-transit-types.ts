import { apiUrl } from "../../config/api";

export const API_CARDTRADER_TRANSIT_LOTS = apiUrl("/cardtrader/transit-lots");

export type CardtraderTransitLotRow = {
  lot_id: string;
  status: string;
  source: string;
  ct0_package_key: string | null;
  purchase_date: string;
  created_at: string;
  total_fx_cards_cost: number;
  total_cop_cards_cost: number;
  cards_cost_currency: string;
  legacy_incoming_batch_id: string | null;
  /** Suma FX de las líneas CT0 registradas (puede ser menor que total_fx_cards_cost legacy). */
  registered_items_fx_subtotal: number | null;
  remaining_total_quantity: number;
};

export type CardtraderTransitLotMeta = {
  lot_id: string;
  status: string;
  source: string;
  ct0_package_key: string | null;
  purchase_date: string;
  total_fx_cards_cost: number;
  total_cop_cards_cost: number;
  real_fx_rate_cop: number;
  cards_cost_currency: string;
  legacy_incoming_batch_id: string | null;
  legacy_incoming_cop_hint: number | null;
  registered_items_fx_subtotal: number | null;
  created_at: string;
};

export type CardtraderTransitLineRow = {
  line_id: string;
  lot_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  quantity_ordered: number;
  remaining_quantity: number;
  fx_total_lot: number;
  fx_unit_price: number;
  unit_cost_cop: number;
  rareza: string | null;
  ct0_item_id: number | null;
  blueprint_id: number | null;
  expansion: string | null;
  collector_number: string | null;
  created_at: string;
};
