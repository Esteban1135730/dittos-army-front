import type { StockListItem } from "../../../types/stock";

export type KeepSale = {
  _id: string;
  stock_id: string;
  card_id: string;
  amount_cop: number;
  notes?: string;
  created_at: string;
};

export type PropertyStockItem = Pick<
  StockListItem,
  "_id" | "card_name" | "image_url" | "card_cost" | "currency" | "card_state" | "card_id" | "rareza"
>;

export type PropertySortKey = "fecha" | "nombre" | "costo";
