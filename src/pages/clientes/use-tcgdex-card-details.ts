import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fetchTcgdexCardDetailsMap,
  looksLikeTcgdexCardId,
  type TcgdexDetailsByCardId,
} from "./tcgdex-card-detail";

export function useTcgdexCardDetails(cardIds: string[]): {
  detailsByCardId: TcgdexDetailsByCardId;
  isLoading: boolean;
} {
  const key = [...new Set(cardIds.map((id) => id?.trim()).filter(looksLikeTcgdexCardId))].sort().join(
    ",",
  );
  const unique = useMemo(() => (key ? key.split(",") : []), [key]);

  const { data, isFetching } = useQuery({
    queryKey: ["tcgdex-card-details", key],
    queryFn: () => fetchTcgdexCardDetailsMap(unique),
    enabled: unique.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  return {
    detailsByCardId: data ?? {},
    isLoading: isFetching && unique.length > 0,
  };
}
