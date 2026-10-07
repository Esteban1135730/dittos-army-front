export type HistorialOrderAs = "buyer" | "seller" | "all";

export type HistorialVariantRow = {
  variant_key: string;
  card_id: string;
  card_name: string;
  language: string;
  rareza: string | null;
  image_url: string;
  qty_ct_buy: number;
  qty_ct_sell: number;
  qty_transit: number;
  qty_stock_sellable: number;
  qty_reserved: number;
  qty_sold_local: number;
  last_sold_local_at: string | null;
  flags: { in_reserva_now: boolean };
};

export type HistorialMeta = {
  generated_at: string;
  ct_orders_scanned: { buyer: number; seller: number };
  unresolved_ct_items: number;
  partial_ct_fetch: boolean;
  tcgdex_resolve_capped?: boolean;
  from: string;
  to: string;
  order_as: HistorialOrderAs;
};

export type HistorialListResponse = {
  meta: HistorialMeta;
  rows: HistorialVariantRow[];
  total: number;
};

export type HistorialEvent = {
  at: string;
  kind: string;
  label: string;
  quantity: number;
  refs: Record<string, string | number | null>;
};
