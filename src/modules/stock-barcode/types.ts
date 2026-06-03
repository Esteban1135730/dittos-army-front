export type StockQrExportRow = {
  stock_id: string;
  qr_value: string;
  card_name: string;
  expansion: string;
  rareza: string | null;
  language: string;
  price_cop: number;
};

/** @deprecated Usar StockQrExportRow */
export type StockBarcodeExportRow = StockQrExportRow & { barcode_value: string };

export type StockScanView = {
  stock_id: string;
  card_id?: string;
  card_name: string;
  image_url: string;
  card_cost: number;
  card_cost_cop?: number;
  currency: string;
  pvp: number | null;
  pvp_currency: string | null;
  price_cop: number | null;
  profit_cop?: number | null;
  expansion?: string;
  rareza?: string | null;
  language?: string;
  card_state?: string;
  sellable?: boolean;
  reject_reason?: string;
};
