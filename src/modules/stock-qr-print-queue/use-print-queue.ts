import { useCallback, useMemo, useState } from "react";
import type { PrintQueueEntry } from "./types";

function normalizeQuantity(quantity: number): number {
  return Math.max(1, Math.floor(quantity));
}

function normalizeStockId(stockId: string): string {
  return String(stockId ?? "").trim().toLowerCase();
}

export function usePrintQueue() {
  const [queue, setQueue] = useState<PrintQueueEntry[]>([]);

  const add = useCallback((stockId: string, quantity: number) => {
    const id = normalizeStockId(stockId);
    if (!id) return;
    const qty = normalizeQuantity(quantity);
    setQueue((prev) => {
      const idx = prev.findIndex((e) => e.stockId === id);
      if (idx === -1) {
        return [...prev, { stockId: id, quantity: qty }];
      }
      const next = [...prev];
      next[idx] = {
        stockId: id,
        quantity: next[idx].quantity + qty,
      };
      return next;
    });
  }, []);

  /** Añade ids faltantes con quantity 1 (no suma si ya estaban). */
  const addManyMissing = useCallback((stockIds: readonly string[]) => {
    if (stockIds.length === 0) return;
    setQueue((prev) => {
      const have = new Set(prev.map((e) => e.stockId));
      const toAdd: PrintQueueEntry[] = [];
      for (const raw of stockIds) {
        const stockId = normalizeStockId(raw);
        if (!stockId || have.has(stockId)) continue;
        have.add(stockId);
        toAdd.push({ stockId, quantity: 1 });
      }
      return toAdd.length === 0 ? prev : [...prev, ...toAdd];
    });
  }, []);

  const setQuantity = useCallback((stockId: string, quantity: number) => {
    const id = normalizeStockId(stockId);
    const qty = Math.floor(quantity);
    setQueue((prev) => {
      if (qty < 1) {
        return prev.filter((e) => e.stockId !== id);
      }
      return prev.map((e) =>
        e.stockId === id ? { ...e, quantity: qty } : e,
      );
    });
  }, []);

  const remove = useCallback((stockId: string) => {
    const id = normalizeStockId(stockId);
    setQueue((prev) => prev.filter((e) => e.stockId !== id));
  }, []);

  const removeMany = useCallback((stockIds: readonly string[]) => {
    if (stockIds.length === 0) return;
    const drop = new Set(stockIds.map(normalizeStockId).filter(Boolean));
    setQueue((prev) => prev.filter((e) => !drop.has(e.stockId)));
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

  const queuedIds = useMemo(
    () => new Set(queue.map((e) => e.stockId)),
    [queue],
  );

  return {
    queue,
    add,
    addManyMissing,
    setQuantity,
    remove,
    removeMany,
    clear,
    totalLabels,
    quantityByStockId,
    queuedIds,
  };
}
