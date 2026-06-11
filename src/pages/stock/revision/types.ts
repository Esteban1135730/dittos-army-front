export type StockReviewOutcome =
  | "perdida"
  | "propiedad"
  | "vendida"
  | "en_stock";

export type StockReviewSessionStatus =
  | "en_verificacion"
  | "pendiente_resolucion"
  | "completada"
  | "cancelada";

export type StockReviewItem = {
  stock_id: string;
  card_id: string;
  card_name: string;
  image_url?: string;
  card_state: string;
  language?: string;
  rareza?: string | null;
  verified: boolean;
  outcome?: StockReviewOutcome | null;
  obsolete?: boolean;
};

export type StockReviewSession = {
  id: string;
  tag: "vintage" | "bulk" | "jugable";
  status: StockReviewSessionStatus;
  items: StockReviewItem[];
  summary: {
    total: number;
    verified: number;
    pending_verification: number;
    pending_resolution: number;
    resolved: number;
  };
  created_at: string;
  updated_at: string;
  completed_at?: string;
};

export type StockLostRow = {
  stock_id: string;
  card_id: string;
  card_name: string;
  image_url?: string;
  language?: string;
  rareza?: string | null;
  card_state: string;
};
