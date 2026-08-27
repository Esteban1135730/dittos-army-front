import { useMemo } from "react";
import type { PedidoLine } from "./pedido-types";
import { collectTcgdexIdsFromLines, type TcgdexDetailsByCardId } from "./tcgdex-card-detail";
import { useTcgdexCardDetails } from "./use-tcgdex-card-details";

export function usePedidoLineasTcgdex(lines: PedidoLine[]): {
  detailsByCardId: TcgdexDetailsByCardId;
  isLoading: boolean;
} {
  const cardIds = useMemo(() => collectTcgdexIdsFromLines(lines), [lines]);
  return useTcgdexCardDetails(cardIds);
}
