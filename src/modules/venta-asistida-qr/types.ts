import type { OwnerKey } from "../../config/owners";

export type StockSellRejectReason =
  | "sin_pvp"
  | "estado_no_vendible"
  | "ya_vendida"
  | "reservada"
  | "propiedad"
  | "sin_stock";

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
  product_kind?: "unit" | "quantity";
  quantity?: number | null;
  substituted?: boolean;
  scanned_stock_id?: string;
  reserved_fallback?: boolean;
  sold_language_fallback?: boolean;
  owner?: OwnerKey;
  owner_ambiguous_resolved?: boolean;
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
  qty?: number;
  product_kind?: "unit" | "quantity";
  reserved?: boolean;
  owner: OwnerKey;
};

export type SellBatchResult = {
  success: boolean;
  sold_count: number;
  results: Array<{
    stock_id: string;
    success: boolean;
    message?: string;
    owner?: OwnerKey;
  }>;
};
