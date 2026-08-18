import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { PedidoLine } from "./pedido-types";
import {
  collectTcgdexIdsFromLines,
  fetchTcgdexCardDetailsMap,
  type TcgdexDetailsByCardId,
} from "./tcgdex-card-detail";

export function usePedidoLineasTcgdex(lines: PedidoLine[]): {
  detailsByCardId: TcgdexDetailsByCardId;
  isLoading: boolean;
} {
  const cardIds = useMemo(() => collectTcgdexIdsFromLines(lines), [lines]);
  const key = cardIds.slice().sort().join(",");

  const { data, isFetching } = useQuery({
    queryKey: ["pedido-lineas-tcgdex", key],
    queryFn: () => fetchTcgdexCardDetailsMap(cardIds),
    enabled: cardIds.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  return {
    detailsByCardId: data ?? {},
    isLoading: isFetching && cardIds.length > 0,
  };
}
