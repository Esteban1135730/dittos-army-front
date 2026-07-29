import type { StockTagId } from "../../../constants/stock-tags";
import { STOCK_TAG_LABEL } from "../../../constants/stock-tags";

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

export type StockReviewScope = "all" | "tag";

export type StockReviewItem = {
  stock_id: string;
  card_id: string;
  card_name: string;
  image_url?: string;
  card_state: string;
  language?: string;
  rareza?: string | null;
  verified: boolean;
  verified_at?: string;
  outcome?: StockReviewOutcome | null;
  obsolete?: boolean;
};

export type StockReviewSession = {
  id: string;
  scope: StockReviewScope;
  tag: StockTagId | null;
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

/** Respuesta de `POST /stock-review/sessions/:sessionId/scan`. */
export type StockReviewScanResponse = {
  session: StockReviewSession;
  scan: {
    verified_stock_id: string;
    card_id: string;
    card_name: string;
    language?: string;
    group_pending_after: number;
  };
};

export type CreateStockReviewSessionBody =
  | { scope: "all" }
  | { scope: "tag"; tag: StockTagId };

export type StockLostRow = {
  stock_id: string;
  card_id: string;
  card_name: string;
  image_url?: string;
  language?: string;
  rareza?: string | null;
  card_state: string;
};

export function sessionScopeLabel(session: StockReviewSession): string {
  if (session.scope === "all") return "Todo el stock";
  if (session.tag && session.tag in STOCK_TAG_LABEL) {
    return STOCK_TAG_LABEL[session.tag];
  }
  return session.tag ?? "Tag";
}
