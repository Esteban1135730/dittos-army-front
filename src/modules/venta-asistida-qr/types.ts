export type StockSellRejectReason =
  | "sin_pvp"
  | "estado_no_vendible"
  | "ya_vendida"
  | "reservada"
  | "propiedad";

export type StockScanView = {
  stock_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  card_cost: number;
  card_cost_cop: number;
  currency: string;
  pvp: number | null;
  pvp_currency: string | null;
  price_cop: number | null;
  profit_cop: number | null;
  expansion: string;
  rareza: string | null;
  language: string;
  card_state: string;
  sellable: boolean;
  reject_reason?: StockSellRejectReason;
  /** La escaneada estaba reservada y se devolvió una copia equivalente disponible. */
  substituted?: boolean;
  /** stock_id de la línea reservada que se escaneó (cuando substituted). */
  scanned_stock_id?: string;
  /** Reservada sin equivalente: vendible, al vender se cancela la reserva. */
  reserved_fallback?: boolean;
};

export type CartLine = {
  stock_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  amount_cop: number;
  card_cost_cop: number;
  expansion: string;
  rareza: string | null;
  language: string;
  /** Línea proveniente de una reserva (fallback): se cancela la reserva al vender. */
  reserved?: boolean;
};

export type SellBatchResult = {
  success: boolean;
  sold_count: number;
  results: Array<{
    stock_id: string;
    success: boolean;
    message?: string;
  }>;
};
