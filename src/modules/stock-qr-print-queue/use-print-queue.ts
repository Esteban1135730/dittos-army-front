import { useCallback, useMemo, useState } from "react";
import type { PrintQueueEntry } from "./types";

function normalizeQuantity(quantity: number): number {
  return Math.max(1, Math.floor(quantity));
}

export function usePrintQueue() {
  const [queue, setQueue] = useState<PrintQueueEntry[]>([]);

  const add = useCallback((stockId: string, quantity: number) => {
    const qty = normalizeQuantity(quantity);
    setQueue((prev) => {
      const idx = prev.findIndex((e) => e.stockId === stockId);
      if (idx === -1) {
        return [...prev, { stockId, quantity: qty }];
      }
      const next = [...prev];
      next[idx] = {
        stockId,
        quantity: next[idx].quantity + qty,
      };
      return next;
    });
  }, []);

  const setQuantity = useCallback((stockId: string, quantity: number) => {
    const qty = Math.floor(quantity);
    setQueue((prev) => {
      if (qty < 1) {
        return prev.filter((e) => e.stockId !== stockId);
      }
      return prev.map((e) =>
        e.stockId === stockId ? { ...e, quantity: qty } : e,
      );
    });
  }, []);

  const remove = useCallback((stockId: string) => {
    setQueue((prev) => prev.filter((e) => e.stockId !== stockId));
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  const totalLabels = useMemo(
    () => queue.reduce((sum, entry) => sum + entry.quantity, 0),
    [queue],
  );

  const quantityByStockId = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of queue) {
      map.set(entry.stockId, entry.quantity);
    }
    return map;
  }, [queue]);

  return {
    queue,
    add,
    setQuantity,
    remove,
    clear,
    totalLabels,
    quantityByStockId,
  };
}
