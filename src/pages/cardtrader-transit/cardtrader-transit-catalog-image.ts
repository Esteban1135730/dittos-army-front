import { apiBase } from "../../config/api";
import { resolveStockImageUrl } from "../../constants/bulk-product";
import {
  resolveCardImageSrc,
  type TcgdexDetailsByCardId,
} from "../../pokemon";
import { blueprintImageProxySrc } from "../../utils/cardtrader-blueprint-image";
import { isLocalCardImagesUrl } from "../../utils/card-images-url";

function looksLikeCardtraderHost(url: string): boolean {
  try {
    if (/^https?:\/\//i.test(url)) {
      const host = new URL(url).hostname.toLowerCase();
      return host === "cardtrader.com" || host.endsWith(".cardtrader.com");
    }
  } catch {
    return false;
  }
  return /cardtrader\.com/i.test(url);
}

/**
 * Imagen para catálogo de tránsito:
 * 1) CDN TCGdex (como en import CT0 / reservas)
 * 2) URL guardada reescrita (`/card-images` → API)
 * 3) Proxy Nest si es CardTrader (hotlink)
 */
export function resolveTransitCatalogImageSrc(
  cardId: string,
  imageUrl: string | null | undefined,
  details: TcgdexDetailsByCardId | Map<string, { imageUrl?: string }>,
  language?: string | null,
): string {
  const fromTcg = resolveCardImageSrc(cardId, "", details as TcgdexDetailsByCardId, language);
  if (fromTcg) return fromTcg;

  const stored = String(imageUrl ?? "").trim();
  if (!stored) return "";

  if (isLocalCardImagesUrl(stored)) {
    const rewritten = resolveStockImageUrl(cardId, stored);
    if (rewritten) return rewritten;
  }

  const rewritten = resolveStockImageUrl(cardId, stored);
  if (!rewritten) return "";

  if (looksLikeCardtraderHost(rewritten)) {
    return blueprintImageProxySrc(rewritten, apiBase()) ?? rewritten;
  }

  return rewritten;
}
