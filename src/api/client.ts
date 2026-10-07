import axios, { isAxiosError } from "axios";
import {
  API_TCG_PREFIX,
  getApiOrigin,
  getApiOwnerHeader,
  getApiTcgHeader,
  resolveAxiosOwner,
  resolveAxiosTcg,
} from "../config/api";

export function getApiBaseUrl(): string {
  return `${getApiOrigin()}${API_TCG_PREFIX}`;
}

/** Cliente HTTP para billing/Factus (prefijo `/pokemon` + headers owner/TCG). */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
});

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers["X-Owner"] = resolveAxiosOwner(config, getApiOwnerHeader());
  config.headers["X-Tcg"] = resolveAxiosTcg(config, getApiTcgHeader());
  return config;
});

export { isAxiosError };
