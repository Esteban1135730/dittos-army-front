export const PEDIDO_PROGRESS_TTL_MS = 48 * 60 * 60 * 1000;

const STORAGE_KEY = "dittos-army.cardtrader-pedido-progress.v1";

export type PedidoLineStatus = "pending" | "done" | "skipped" | "in_cart";

export type PedidoProgressSnapshot = {
  savedAt: number;
  rawPaste: string;
  statusByLineId: Record<string, PedidoLineStatus>;
  /** Unidades ya añadidas al carrito por línea (puede ser parcial por stock). */
  addedQtyByLineId?: Record<string, number>;
  activeLineId: string | null;
  /** Líneas ya resueltas (URLs o cotización WhatsApp). Si falta, se reparsea `rawPaste` como URLs. */
  lines?: import("./parse-cardtrader-pedido").ParsedPedidoLine[];
};

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadPedidoProgress(): PedidoProgressSnapshot | null {
  const ls = getLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PedidoProgressSnapshot;
    if (typeof data.savedAt !== "number") return null;
    if (Date.now() - data.savedAt > PEDIDO_PROGRESS_TTL_MS) {
      ls.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function savePedidoProgress(snapshot: Omit<PedidoProgressSnapshot, "savedAt">): void {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const payload: PedidoProgressSnapshot = { ...snapshot, savedAt: Date.now() };
    ls.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearPedidoProgress(): void {
  getLocalStorage()?.removeItem(STORAGE_KEY);
}
