import axios from "axios";
import type { OwnerKey } from "./owners";
import { OWNERS_CONFIG } from "./owners";
import { YUGIOH_UI_PREFIX, panelBasenameForPath } from "./routes";

const API_PORT = import.meta.env.VITE_API_PORT ?? "3000";

/** Nest product API path prefix (Pokémon surface URL; Yu-Gi-Oh uses X-Tcg). */
export const API_TCG_PREFIX = "/pokemon";

export type ApiTcg = "pokemon" | "yugioh";

/**
 * Origen del API Nest (sin `/pokemon`, sin barra final).
 * En dev: mismo origen HTTPS + proxy Vite `/api` → Nest (`VITE_API_PORT`, default 3000).
 * Override: VITE_API_BASE=https://otro-host:3000
 */
export function getApiOrigin(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    if (import.meta.env.DEV) {
      return `${window.location.origin}/api`;
    }
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

/** @deprecated Preferir `getApiOrigin()`; nombre histórico = origen sin TCG. */
export function getApiBase(): string {
  return getApiOrigin();
}

/** Origen del API (sin `/pokemon`). */
export function apiOrigin(): string {
  return getApiOrigin();
}

/** Base del API de producto Pokémon (`origin` + `/pokemon`). */
export function tcgApiBase(): string {
  return `${getApiOrigin()}${API_TCG_PREFIX}`;
}

/**
 * Base usada por proxy CardTrader / concatenaciones legacy.
 * Incluye `/pokemon` (controladores Nest bajo el prefijo global).
 */
export function apiBase(): string {
  return tcgApiBase();
}

/**
 * @deprecated Preferir `apiUrl()` o `tcgApiBase()`.
 * Incluye `/pokemon` para que `${API_BASE}/stock` siga siendo correcto.
 */
export const API_BASE = `${getApiOrigin()}${API_TCG_PREFIX}`;

function withTcgPrefix(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/card-images")) {
    return normalized;
  }
  if (normalized === "/health" || normalized.startsWith("/health?")) {
    return normalized;
  }
  if (normalized === "/yugioh" || normalized.startsWith("/yugioh/")) {
    return normalized;
  }
  if (
    normalized === API_TCG_PREFIX ||
    normalized.startsWith(`${API_TCG_PREFIX}/`)
  ) {
    return normalized;
  }
  return `${API_TCG_PREFIX}${normalized}`;
}

export function apiUrl(path: string): string {
  return `${getApiOrigin()}${withTcgPrefix(path)}`;
}

/** Active owner for Axios default instance (034). */
let activeApiOwner: OwnerKey = OWNERS_CONFIG.defaultOwner;

/** Active TCG for Axios — Yu-Gi-Oh panel hits the same Nest routes with X-Tcg. */
let activeApiTcg: ApiTcg =
  panelBasenameForPath(
    typeof window !== "undefined" ? window.location.pathname : "/pokemon",
  ) === YUGIOH_UI_PREFIX
    ? "yugioh"
    : "pokemon";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Per-request X-Owner without changing the layout profile (037). */
    ownerOverride?: OwnerKey;
    /** Per-request X-Tcg override. */
    tcgOverride?: ApiTcg;
  }
}

export function resolveAxiosOwner(
  config: { ownerOverride?: OwnerKey },
  active: OwnerKey,
): OwnerKey {
  return config.ownerOverride ?? active;
}

export function resolveAxiosTcg(
  config: { tcgOverride?: ApiTcg },
  active: ApiTcg,
): ApiTcg {
  return config.tcgOverride ?? active;
}

export function setApiOwnerHeader(owner: OwnerKey) {
  activeApiOwner = owner;
  axios.defaults.headers.common["X-Owner"] = owner;
}

export function getApiOwnerHeader(): OwnerKey {
  return activeApiOwner;
}

export function setApiTcgHeader(tcg: ApiTcg) {
  activeApiTcg = tcg;
  axios.defaults.headers.common["X-Tcg"] = tcg;
}

export function getApiTcgHeader(): ApiTcg {
  return activeApiTcg;
}

// Interceptor on the shared axios default instance (panel uses `import axios from "axios"`).
axios.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers["X-Owner"] = resolveAxiosOwner(config, activeApiOwner);
  config.headers["X-Tcg"] = resolveAxiosTcg(config, activeApiTcg);
  return config;
});

setApiOwnerHeader(OWNERS_CONFIG.defaultOwner);
setApiTcgHeader(activeApiTcg);
