import axios from "axios";
import { apiUrl } from "../config/api";

export type EnsureBulkResult = {
  stock_id: string;
  card_id: string;
  card_name: string;
  product_kind: "quantity";
  quantity: number;
  created: boolean;
  pvp_ensured: boolean;
};

/** Seed idempotente del SKU bulk. No lanza: el caller decide snackbar. */
export async function ensureBulkProduct(): Promise<{
  ok: boolean;
  data?: EnsureBulkResult;
  error?: string;
}> {
  try {
    const res = await axios.post<EnsureBulkResult>(
      apiUrl("/stock/ensure-bulk"),
    );
    return { ok: true, data: res.data };
  } catch (e) {
    const msg = axios.isAxiosError(e)
      ? (e.response?.data?.message as string) || e.message
      : "No se pudo asegurar el SKU bulk";
    return { ok: false, error: msg };
  }
}
