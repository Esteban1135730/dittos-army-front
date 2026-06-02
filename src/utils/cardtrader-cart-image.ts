import {
  upsertCardtraderCartMeta,
  type CardtraderCartItemMeta,
} from "./cardtrader-cart-meta-cache";

const memoryImageDataByProductId = new Map<number, string>();

export function getMemoryCartImageDataUrl(productId: number): string | undefined {
  return memoryImageDataByProductId.get(productId);
}

export function setMemoryCartImageDataUrl(productId: number, dataUrl: string): void {
  if (!dataUrl.startsWith("data:")) return;
  memoryImageDataByProductId.set(productId, dataUrl);
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/** Descarga imagen vía proxy Nest (evita CORS) y devuelve data URL para jsPDF. */
export async function fetchCartImageDataUrl(
  imageUrl: string,
  apiBase: string,
): Promise<string | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  const proxyUrl = `${apiBase.replace(/\/$/, "")}/cardtrader/images/proxy?url=${encodeURIComponent(trimmed)}`;
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/** Guarda metadata en localStorage y precarga imageDataUrl vía proxy (PDF / miniatura carrito). */
export async function upsertCardtraderCartMetaWithImage(
  productId: number,
  meta: CardtraderCartItemMeta,
  apiBase: string,
): Promise<CardtraderCartItemMeta> {
  let merged = upsertCardtraderCartMeta(productId, meta);
  const imageUrl = merged.imageUrl?.trim();
  if (!imageUrl || merged.imageDataUrl?.startsWith("data:")) {
    return merged;
  }

  const dataUrl = await fetchCartImageDataUrl(imageUrl, apiBase);
  if (!dataUrl) {
    return merged;
  }

  setMemoryCartImageDataUrl(productId, dataUrl);
  merged = upsertCardtraderCartMeta(productId, { imageDataUrl: dataUrl });
  return merged;
}

/** Src para `<img>` del carrito: data URL en caché o proxy Nest (evita CDN bloqueado en UI). */
export function resolveCartThumbnailSrc(args: {
  productId: number;
  imageDataUrl?: string;
  imageUrl?: string;
  apiBase: string;
}): string | undefined {
  if (args.imageDataUrl?.startsWith("data:")) {
    return args.imageDataUrl;
  }

  const fromMemory = getMemoryCartImageDataUrl(args.productId);
  if (fromMemory) {
    return fromMemory;
  }

  const url = args.imageUrl?.trim();
  if (!url) {
    return undefined;
  }

  const base = args.apiBase.replace(/\/$/, "");
  return `${base}/cardtrader/images/proxy?url=${encodeURIComponent(url)}`;
}

export async function resolveCartImageDataUrlForPdf(args: {
  productId: number;
  imageDataUrl?: string;
  imageUrl?: string;
  apiBase: string;
}): Promise<string | null> {
  if (args.imageDataUrl?.startsWith("data:")) {
    return args.imageDataUrl;
  }

  const fromMemory = getMemoryCartImageDataUrl(args.productId);
  if (fromMemory) return fromMemory;

  if (!args.imageUrl?.trim()) return null;

  const fetched = await fetchCartImageDataUrl(args.imageUrl, args.apiBase);
  if (fetched) {
    setMemoryCartImageDataUrl(args.productId, fetched);
  }
  return fetched;
}
