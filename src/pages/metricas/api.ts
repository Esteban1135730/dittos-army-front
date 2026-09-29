import axios from "axios";
import { otherOwner, type OwnerKey } from "../../config/owners";
import { apiUrl } from "../../config/api";
import { mergeMetricsAnalytics } from "./merge-metrics";
import type { MetricsAnalyticsResponse } from "./types";

async function fetchMetricsForOwner(params: {
  from: string;
  to: string;
  ownerOverride: OwnerKey;
}): Promise<MetricsAnalyticsResponse> {
  const res = await axios.get(apiUrl("/metrics/analytics"), {
    params: { from: params.from, to: params.to },
    ownerOverride: params.ownerOverride,
  });
  return res.data as MetricsAnalyticsResponse;
}

/**
 * Pokémon (pablo/esteban): fetches both owners in parallel and merges.
 * Yu-Gi-Oh (tefa): single-owner fetch as before.
 */
export async function fetchMetricsAnalytics(params: {
  from: string;
  to: string;
  owner: OwnerKey;
}): Promise<MetricsAnalyticsResponse> {
  const pair = otherOwner(params.owner);
  if (!pair) {
    return fetchMetricsForOwner({
      from: params.from,
      to: params.to,
      ownerOverride: params.owner,
    });
  }

  const ownerA: OwnerKey = "pablo";
  const ownerB: OwnerKey = "esteban";
  const [a, b] = await Promise.all([
    fetchMetricsForOwner({
      from: params.from,
      to: params.to,
      ownerOverride: ownerA,
    }),
    fetchMetricsForOwner({
      from: params.from,
      to: params.to,
      ownerOverride: ownerB,
    }),
  ]);
  return mergeMetricsAnalytics(a, b, ownerA, ownerB);
}
