import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { apiUrl } from "../../config/api";
import { isOwnerKey, type OwnerKey } from "../../config/owners";
import type {
  HistorialEvent,
  HistorialListResponse,
  HistorialOrderAs,
} from "./cardtrader-orders-historial.types";

const API = apiUrl("/cardtrader/orders-historial");

export type HistorialFilters = {
  from: string;
  to: string;
  orderAs: HistorialOrderAs;
  owner: string;
  q: string;
  page: number;
};

export function useOrdersHistorial(filters: HistorialFilters) {
  return useQuery({
    queryKey: [
      "cardtrader-orders-historial",
      filters.from,
      filters.to,
      filters.orderAs,
      filters.owner,
      filters.q,
      filters.page,
    ],
    queryFn: async () => {
      const ownerOverride =
        filters.owner !== "all" && isOwnerKey(filters.owner)
          ? filters.owner
          : undefined;
      const res = await axios.get<HistorialListResponse>(API, {
        params: {
          from: filters.from,
          to: filters.to,
          order_as: filters.orderAs,
          owner: ownerOverride,
          q: filters.q.trim() || undefined,
          page: filters.page,
          limit: 50,
        },
        ownerOverride,
        timeout: 300_000,
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrdersHistorialEvents(
  variantKey: string | null,
  filters: Pick<HistorialFilters, "from" | "to" | "orderAs" | "owner">,
) {
  return useQuery({
    queryKey: [
      "cardtrader-orders-historial-events",
      variantKey,
      filters.from,
      filters.to,
      filters.orderAs,
      filters.owner,
    ],
    enabled: !!variantKey,
    queryFn: async () => {
      const ownerOverride =
        filters.owner !== "all" && isOwnerKey(filters.owner)
          ? filters.owner
          : undefined;
      const res = await axios.get<{ events: HistorialEvent[] }>(
        `${API}/${encodeURIComponent(variantKey!)}/events`,
        {
          params: {
            from: filters.from,
            to: filters.to,
            order_as: filters.orderAs,
            owner: ownerOverride,
          },
          ownerOverride,
          timeout: 300_000,
        },
      );
      return res.data.events;
    },
    staleTime: 5 * 60 * 1000,
  });
}
