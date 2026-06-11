const API_PORT = import.meta.env.VITE_API_PORT ?? "3000";

/**
 * URL base del API Nest (sin barra final).
 * En dev: mismo origen HTTPS + proxy Vite `/api` → Nest (`VITE_API_PORT`, default 3000).
 * Override: VITE_API_BASE=https://otro-host:3000
 */
export function getApiBase(): string {
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

/** Siempre resuelve en el momento (correcto tras HTTPS / proxy en dev). */
export function apiBase(): string {
  return getApiBase();
}

/** @deprecated Preferir `apiBase()` o `apiUrl()` para lecturas dinámicas. */
export const API_BASE = getApiBase();

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}${normalized}`;
}
