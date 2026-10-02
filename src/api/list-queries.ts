import axios from "axios";
import { apiUrl } from "../config/api";
import type { OwnerKey } from "../config/owners";
import type { StockListItem } from "../types/stock";
import { filterStockVisibleInGrid } from "../utils/stock-grid-visible";
import { normalizeClientItem, normalizeClientList } from "../pages/clientes/cliente-id";
import type { ClientItem } from "../pages/clientes/cliente-types";

/**
 * `["stock"]` y `["stock", owner]` guardan siempre la respuesta cruda de `GET /stock`
 * (todas las líneas); cada pantalla deriva su vista con `select`.
 */
export const STOCK_LIST_QUERY_KEY = ["stock"] as const;

export async function fetchStockListRaw(owner?: OwnerKey): Promise<StockListItem[]> {
  const res = await axios.get(
    apiUrl("/stock"),
    owner ? { ownerOverride: owner } : undefined,
  );
  return Array.isArray(res.data) ? res.data : [];
}

/** Referencia estable para `select` (TanStack solo recalcula si cambian los datos). */
export function selectStockVisibleInGrid(rows: StockListItem[]): StockListItem[] {
  return filterStockVisibleInGrid(rows);
}

/** `["clientes"]` guarda la respuesta cruda de `GET /client`; se normaliza con `select`. */
export const CLIENTES_QUERY_KEY = ["clientes"] as const;

export async function fetchClientesRaw(): Promise<unknown[]> {
  const res = await axios.get(apiUrl("/client"));
  return Array.isArray(res.data) ? res.data : [];
}

export function selectClientList(raw: unknown[]): ClientItem[] {
  return normalizeClientList(raw);
}

/** `["client", clientId]`: mismo `queryFn` en todas las pantallas (ficha normalizada). */
export async function fetchClientById(clientId: string): Promise<ClientItem> {
  const res = await axios.get(`${apiUrl("/client")}/${clientId}`);
  const normalized = normalizeClientItem(res.data);
  if (!normalized) {
    throw new Error("Cliente no encontrado en el servidor.");
  }
  return normalized;
}
