import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { apiUrl } from "../../config/api";
import type { StockPvpBenchmarkResponse } from "./stock-pvp-benchmark.types";

const API = apiUrl("/metrics/stock-pvp-benchmark");

export type BenchmarkFilters = {
  from: string;
  to: string;
};

export function useStockPvpBenchmark(filters: BenchmarkFilters) {
  return useQuery({
    queryKey: ["stock-pvp-benchmark", filters.from, filters.to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.from.trim()) params.from = filters.from.trim();
      if (filters.to.trim()) params.to = filters.to.trim();
      const res = await axios.get<StockPvpBenchmarkResponse>(API, { params });
      return res.data;
    },
    staleTime: 60_000,
  });
}
