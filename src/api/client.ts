import axios from "axios";

/**
 * URL base de la API (variable `VITE_API_URL` en build; fallback desarrollo local).
 * Sin barra final — Axios concatena `baseURL` + `url` correctamente.
 */
export function getApiBaseUrl(): string {
  const raw =
    import.meta.env.VITE_API_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Cliente HTTP único para todas las llamadas al backend Nest. */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
});

export { isAxiosError } from "axios";
