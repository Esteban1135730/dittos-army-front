/**
 * Contrato de stock alineado con el backend (StockDto / schema).
 * `card_name` se persiste en base; no depender de TCGdex en listados.
 */

export type CreateStockRequestBody = {
  card_id: string;
  card_name: string;
  image_url: string;
  shipment: number;
  unity_cost: number;
  cards_in_shipmet: number;
  currency: string;
  card_state?: string;
  language?: string;
  holofoil?: boolean;
  league_card?: boolean;
  incoming_notes?: string;
  /** Variante operativa; omitir o vacío = sin variante */
  rareza?: string | null;
  /** Tags de clasificación (catálogo cerrado en API) */
  tags?: string[];
};

export type UpdateStockRequestBody = CreateStockRequestBody & {
  id: string;
};

/** Fila típica de GET /stock (incluye campos calculados como card_cost). */
export type StockListItem = {
  _id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  shipment: number;
  unity_cost: number;
  cards_in_shipmet: number;
  card_state: string;
  currency: string;
  card_cost: number;
  pvp?: number;
  pvp_currency?: string;
  league_card?: boolean;
  language?: string;
  holofoil?: boolean;
  rareza?: string | null;
  tags?: string[];
  incoming_notes?: string;
};

