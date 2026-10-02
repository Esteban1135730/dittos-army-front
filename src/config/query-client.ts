import type { AxiosInstance } from "axios";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  type Query,
  type QueryKey,
} from "@tanstack/react-query";

export const QUERY_DEFAULT_STALE_TIME_MS = 30_000;
export const QUERY_GC_TIME_MS = 1000 * 60 * 60 * 24; // 24 hours

export function createPanelQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: QUERY_GC_TIME_MS,
        staleTime: QUERY_DEFAULT_STALE_TIME_MS,
        refetchOnWindowFocus: refetchOperationalOnWindowFocus,
      },
    },
  });
}

/**
 * Listas operativas que otro operador (u otro dispositivo, p. ej. la app móvil) puede cambiar
 * mientras el panel está en segundo plano: stock, reservas, clientes/pedidos y ventas.
 * Se compara solo la raíz de la clave (`["stock", owner]` → `stock`).
 */
const OPERATIONAL_QUERY_ROOTS = new Set([
  "stock",
  "reservas",
  "reservas-incoming",
  "clientes",
  "client",
  "pedidos",
  "sales-dashboard",
  "sales-history",
  "ventas-cliente",
  "sales-mobile-pending",
]);

export function isOperationalQueryKey(queryKey: QueryKey): boolean {
  const [root] = queryKey;
  return typeof root === "string" && OPERATIONAL_QUERY_ROOTS.has(root);
}

/**
 * Al volver a la pestaña, las listas operativas se piden siempre (aunque no hayan pasado los 30 s
 * de `staleTime`) para ver ventas/reservas hechas desde otro puesto; el resto no refetchea.
 */
export function refetchOperationalOnWindowFocus(query: Query): "always" | false {
  return isOperationalQueryKey(query.queryKey) ? "always" : false;
}

/**
 * Solo catálogos pequeños y no operativos se guardan en localStorage.
 * Stock, ventas, clientes, reservas, pedidos, tránsito, métricas, etc. nunca se persisten.
 */
const PERSISTED_QUERY_ROOTS = new Set(["catalog-sets", "expansiones", "pedido-tiendas"]);

export function isPersistableQueryKey(queryKey: QueryKey): boolean {
  const [root, sub] = queryKey;
  if (typeof root !== "string") return false;
  if (PERSISTED_QUERY_ROOTS.has(root)) return true;
  return root === "cardtrader" && sub === "expansions";
}

export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && isPersistableQueryKey(query.queryKey);
}

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

function isWriteMethod(method: string | undefined): boolean {
  return WRITE_METHODS.has((method ?? "get").toLowerCase());
}

/**
 * Tras cualquier escritura HTTP (éxito o error) marca toda la caché como obsoleta sin refetch
 * inmediato: la siguiente pantalla que monte una query vuelve a pedirla, como con `staleTime: 0`,
 * aunque el handler que escribió no invalidara esa clave.
 */
export function installStaleOnWriteInterceptor(
  client: QueryClient,
  http: AxiosInstance,
): number {
  const markStale = (method: string | undefined) => {
    if (isWriteMethod(method)) {
      void client.invalidateQueries({ refetchType: "none" });
    }
  };
  return http.interceptors.response.use(
    (res) => {
      markStale(res.config?.method);
      return res;
    },
    (err: unknown) => {
      const method = (err as { config?: { method?: string } } | null)?.config?.method;
      markStale(method);
      return Promise.reject(err);
    },
  );
}
