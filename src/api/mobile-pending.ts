import axios from "axios";
import { apiUrl } from "../config/api";

export type MobilePendingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "conflict";

export type MobilePendingSale = {
  _id: string;
  status: MobilePendingStatus;
  stock_id: string;
  stock_owner: "pablo" | "esteban";
  amount_cop: number;
  notes?: string;
  card_name?: string;
  image_url?: string;
  card_id?: string;
  client_sale_id: string;
  created_at: string;
  resolved_at?: string;
  conflict_reason?: string;
  sale_id?: string;
};

export type AcceptMobilePendingResult = {
  pending: MobilePendingSale;
  sale?: {
    success: boolean;
    sale_id?: string;
    stock_id: string;
    owner: "pablo" | "esteban";
  };
};

const LIST_QUERY = { status: "pending,conflict" };

export async function listMobilePendingSales(): Promise<MobilePendingSale[]> {
  const res = await axios.get<MobilePendingSale[]>(
    apiUrl("/sales/mobile-pending"),
    { params: LIST_QUERY },
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function acceptMobilePendingSale(
  id: string,
): Promise<AcceptMobilePendingResult> {
  const res = await axios.post<AcceptMobilePendingResult>(
    apiUrl(`/sales/mobile-pending/${id}/accept`),
  );
  return res.data;
}

export async function rejectMobilePendingSale(
  id: string,
): Promise<{ status: string; pending: MobilePendingSale }> {
  const res = await axios.post<{ status: string; pending: MobilePendingSale }>(
    apiUrl(`/sales/mobile-pending/${id}/reject`),
  );
  return res.data;
}
