import { fetchCartImageDataUrl } from "./cardtrader-cart-image";

/** Imágenes de blueprint vistas en Pedido cliente (no depende del carrito). */
export const PEDIDO_BLUEPRINT_IMAGE_TTL_MS = 20 * 60 * 1000;

const STORAGE_KEY = "dittos-army.cardtrader-pedido-blueprint-images.v1";

type StoredEntry = {
  blueprintId: number;
  imageUrl?: string;
  imageDataUrl?: string;
  savedAt: number;
};

type StorePayload = {
  v: 1;
  items: Record<string, StoredEntry>;
};

const memoryByBlueprintId = new Map<number, StoredEntry>();

function ls(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStore(): StorePayload {
  const storage = ls();
  if (!storage) return { v: 1, items: {} };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { v: 1, items: {} };
    const data = JSON.parse(raw) as StorePayload;
    if (data.v !== 1 || !data.items || typeof data.items !== "object") {
      return { v: 1, items: {} };
    }
    return data;
  } catch {
    return { v: 1, items: {} };
  }
}

function writeStore(payload: StorePayload): void {
  const storage = ls();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

function prune(items: Record<string, StoredEntry>): Record<string, StoredEntry> {
  const now = Date.now();
  const next: Record<string, StoredEntry> = {};
  for (const [key, entry] of Object.entries(items)) {
    if (!entry || typeof entry.savedAt !== "number") continue;
    if (now - entry.savedAt > PEDIDO_BLUEPRINT_IMAGE_TTL_MS) continue;
    if (!entry.imageDataUrl?.startsWith("data:")) continue;
    next[key] = entry;
  }
  return next;
}

function loadEntry(blueprintId: number): StoredEntry | null {
  const mem = memoryByBlueprintId.get(blueprintId);
  if (mem && Date.now() - mem.savedAt <= PEDIDO_BLUEPRINT_IMAGE_TTL_MS) {
    return mem;
  }

  const store = readStore();
  const pruned = prune(store.items);
  if (Object.keys(pruned).length !== Object.keys(store.items).length) {
    writeStore({ v: 1, items: pruned });
  }

  const entry = pruned[String(blueprintId)];
  if (!entry) return null;
  memoryByBlueprintId.set(blueprintId, entry);
  return entry;
}

function saveEntry(entry: StoredEntry): void {
  memoryByBlueprintId.set(entry.blueprintId, entry);
  const store = readStore();
  const pruned = prune(store.items);
  pruned[String(entry.blueprintId)] = entry;
  writeStore({ v: 1, items: pruned });
}

function proxyImageUrl(imageUrl: string, apiBase: string): string {
  const base = apiBase.replace(/\/$/, "");
  return `${base}/cardtrader/images/proxy?url=${encodeURIComponent(imageUrl.trim())}`;
}

/** Src para mostrar: data URL en caché o proxy mientras se precarga. */
export function getPedidoBlueprintImageDisplaySrc(
  blueprintId: number,
  fallbackImageUrl: string | null | undefined,
  apiBase: string,
): string | undefined {
  const cached = loadEntry(blueprintId);
  if (cached?.imageDataUrl?.startsWith("data:")) {
    return cached.imageDataUrl;
  }

  const url = fallbackImageUrl?.trim() || cached?.imageUrl?.trim();
  if (!url) return undefined;
  return proxyImageUrl(url, apiBase);
}

/** Descarga vía proxy y guarda en caché 20 min (al abrir una línea en Pedido cliente). */
export async function cachePedidoBlueprintImage(
  blueprintId: number,
  imageUrl: string,
  apiBase: string,
): Promise<string | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  const existing = loadEntry(blueprintId);
  if (existing?.imageDataUrl?.startsWith("data:") && existing.imageUrl === trimmed) {
    return existing.imageDataUrl;
  }

  const dataUrl = await fetchCartImageDataUrl(trimmed, apiBase);
  if (!dataUrl) return null;

  saveEntry({
    blueprintId,
    imageUrl: trimmed,
    imageDataUrl: dataUrl,
    savedAt: Date.now(),
  });

  return dataUrl;
}

export function clearPedidoBlueprintImageCache(): void {
  memoryByBlueprintId.clear();
  ls()?.removeItem(STORAGE_KEY);
}
