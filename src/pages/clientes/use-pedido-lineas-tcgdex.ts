import { useMemo } from "react";
import type { PedidoLine } from "./pedido-types";
import { collectTcgdexIdsFromLines, type TcgdexDetailsByCardId } from "../../pokemon";
import { useTcgdexCardDetails } from "../../pokemon";

export function usePedidoLineasTcgdex(lines: PedidoLine[]): {
  detailsByCardId: TcgdexDetailsByCardId;
  isLoading: boolean;
} {
  const cardIds = useMemo(() => collectTcgdexIdsFromLines(lines), [lines]);
  return useTcgdexCardDetails(cardIds);
}
