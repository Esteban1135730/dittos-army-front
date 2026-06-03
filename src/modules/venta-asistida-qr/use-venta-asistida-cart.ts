import { useCallback, useMemo, useState } from "react";
import {
  addCartLine,
  cartTotalCop,
  cartTotalProfitCop,
  removeCartLine,
  removeSoldFromCart,
  updateCartLinePrice,
} from "./cart-helpers";
import type { CartLine } from "./types";

export function useVentaAsistidaCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addLine = useCallback((line: CartLine): "ok" | "duplicate" => {
    let status: "ok" | "duplicate" = "ok";
    setLines((prev) => {
      const next = addCartLine(prev, line);
      status = next.status;
      return next.lines;
    });
    return status;
  }, []);

  const removeLine = useCallback((stockId: string) => {
    setLines((prev) => removeCartLine(prev, stockId));
  }, []);

  const updatePrice = useCallback((stockId: string, amountCop: number) => {
    setLines((prev) => updateCartLinePrice(prev, stockId, amountCop));
  }, []);

  const removeSold = useCallback((stockIds: string[]) => {
    setLines((prev) => removeSoldFromCart(prev, stockIds));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalCop = useMemo(() => cartTotalCop(lines), [lines]);
  const totalProfitCop = useMemo(() => cartTotalProfitCop(lines), [lines]);

  return {
    lines,
    addLine,
    removeLine,
    updatePrice,
    removeSold,
    clear,
    totalCop,
    totalProfitCop,
  };
}
