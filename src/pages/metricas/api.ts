import axios from "axios";
import { apiUrl } from "../../config/api";
import type { MetricsAnalyticsResponse } from "./types";

export async function fetchMetricsAnalytics(params: {
  from: string;
  to: string;
}): Promise<MetricsAnalyticsResponse> {
  const res = await axios.get(apiUrl("/metrics/analytics"), {
    params: { from: params.from, to: params.to },
  });
  return res.data as MetricsAnalyticsResponse;
}
