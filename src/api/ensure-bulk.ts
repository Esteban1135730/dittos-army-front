import axios from "axios";
import { apiUrl, getApiOwnerHeader, getApiTcgHeader } from "../config/api";

export type EnsureBulkResult = {
  stock_id: string;
  card_id: string;
  card_name: string;
  product_kind: "quantity";
  quantity: number;
  created: boolean;
  pvp_ensured: boolean;
};

export type EnsureBulkOutcome = {
  ok: boolean;
  data?: EnsureBulkResult;
  error?: string;
};

/** Una sola llamada por sesión de pestaña y combinación TCG + owner (el seed es idempotente). */
const ensuredByScope = new Map<string, Promise<EnsureBulkOutcome>>();

async function postEnsureBulk(): Promise<EnsureBulkOutcome> {
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

/**
 * Seed idempotente del SKU bulk. No lanza: el caller decide snackbar.
 * Repetir la llamada en la misma sesión reutiliza el resultado; solo el primer caller
 * recibe `created: true` (los siguientes ven `created: false`, el SKU ya existe).
 * Si falla, no se memoriza y el siguiente montaje reintenta.
 */
export function ensureBulkProduct(): Promise<EnsureBulkOutcome> {
  const scope = `${getApiTcgHeader()}:${getApiOwnerHeader()}`;
  const existing = ensuredByScope.get(scope);
  if (existing) {
    return existing.then((r) =>
      r.ok && r.data ? { ...r, data: { ...r.data, created: false } } : r,
    );
  }
  const pending = postEnsureBulk().then((r) => {
    if (!r.ok) ensuredByScope.delete(scope);
    return r;
  });
  ensuredByScope.set(scope, pending);
  return pending;
}

/** Solo tests. */
export function resetEnsureBulkCacheForTests(): void {
  ensuredByScope.clear();
}
