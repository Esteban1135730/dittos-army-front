import {
  buildCartMetaFromOffer,
  loadCardtraderCartMetaCache,
  type CardtraderCartItemMeta,
} from "./cardtrader-cart-meta-cache";
import { upsertCardtraderCartMetaWithImage } from "./cardtrader-cart-image";
import type { CtMarketplaceProduct } from "./cardtrader-marketplace-offers";

export type CartBlueprintRef = {
  id: number;
  name?: string;
  name_en?: string;
  image_url?: string | null;
  fixed_properties?: {
    collector_number?: string;
    pokemon_rarity?: string;
    mtg_rarity?: string;
    rarity?: string;
  };
};

/** Product IDs del carrito que pertenecen al blueprint (vista en buscador). */
export function cartProductIdsForBlueprint(
  cart: unknown,
  blueprintId: number,
  metaByProductId: Record<number, CardtraderCartItemMeta> = {},
): number[] {
  const ids: number[] = [];
  if (!cart || typeof cart !== "object") return ids;

  const subcarts = (cart as { subcarts?: unknown[] }).subcarts;
  if (!Array.isArray(subcarts)) return ids;

  for (const sc of subcarts) {
    if (!sc || typeof sc !== "object") continue;
    const items = (sc as { cart_items?: unknown[] }).cart_items;
    if (!Array.isArray(items)) continue;

    for (const ci of items) {
      if (!ci || typeof ci !== "object") continue;
      const row = ci as {
        product?: {
          id?: number | string;
          name_en?: string;
          blueprint_id?: number;
          marketplace_meta?: {
            blueprint_id?: number;
            properties_hash?: Record<string, unknown>;
          };
        };
      };

      const rawId = row.product?.id;
      const productId =
        typeof rawId === "number" ? rawId : typeof rawId === "string" ? Number(rawId) : NaN;
      if (!Number.isFinite(productId)) continue;

      const bpId =
        row.product?.marketplace_meta?.blueprint_id ??
        row.product?.blueprint_id ??
        metaByProductId[productId]?.blueprintId;

      if (bpId === blueprintId) {
        ids.push(productId);
      }
    }
  }

  return ids;
}

/**
 * Al abrir un blueprint en el buscador, persiste metadata (e imagen) de ítems del carrito
 * que correspondan a esa carta.
 */
export async function enrichCartMetaFromBlueprintBrowse(args: {
  cart: unknown;
  blueprint: CartBlueprintRef;
  expansion?: { name_en?: string; name?: string } | null;
  marketplaceProducts?: CtMarketplaceProduct[];
  blueprintImageUrl?: string;
  apiBase: string;
}): Promise<Record<number, CardtraderCartItemMeta>> {
  const stored = loadCardtraderCartMetaCache();
  const productIds = cartProductIdsForBlueprint(args.cart, args.blueprint.id, stored);
  if (!productIds.length) return {};

  const offersById = new Map((args.marketplaceProducts ?? []).map((p) => [p.id, p]));
  const imageUrl =
    args.blueprint.image_url?.trim() || args.blueprintImageUrl?.trim() || undefined;
  const updates: Record<number, CardtraderCartItemMeta> = {};

  for (const productId of productIds) {
    const offer = offersById.get(productId);
    const cached = stored[productId];
    const meta = buildCartMetaFromOffer({
      product: offer ?? {
        id: productId,
        blueprint_id: args.blueprint.id,
        name_en: offer?.name_en ?? cached?.name,
        properties_hash: offer?.properties_hash,
      },
      blueprint: args.blueprint,
      expansion: args.expansion ?? null,
      blueprintImageUrl: imageUrl,
    });
    updates[productId] = await upsertCardtraderCartMetaWithImage(productId, meta, args.apiBase);
  }

  return updates;
}
