export type StockBarcodeExportRow = {
  stock_id: string;
  barcode_value: string;
  card_name: string;
};

export type StockScanView = {
  stock_id: string;
  card_name: string;
  image_url: string;
  card_cost: number;
  currency: string;
  pvp: number | null;
  pvp_currency: string | null;
  price_cop: number | null;
};
