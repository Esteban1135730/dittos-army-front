/** Metadata de productos CardTrader añadidos al carrito (panel /cotizar). */

export const CARDTRADER_CART_META_TTL_MS = 48 * 60 * 60 * 1000;

const STORAGE_KEY = "dittos-army.cardtrader-cart-meta.v1";
const VERSION = 1 as const;

export type CardtraderCartItemMeta = {
  name?: string;
  expansion?: string;
  condition?: string;
  language?: string;
  collectorNumber?: string;
  blueprintId?: number;
  imageUrl?: string;
  /** JPEG/PNG en base64 para PDF sin CORS. */
  imageDataUrl?: string;
  rarity?: string;
  /** PVP manual en COP (precio especial para exportar al cliente). */
  pvpPropioCop?: number;
};

type StoredItem = {
  savedAt: number;
  meta: CardtraderCartItemMeta;
};

type StorePayload = {
  v: typeof VERSION;
  items: Record<string, StoredItem>;
};

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStore(): StorePayload {
  const ls = getLocalStorage();
  if (!ls) return { v: VERSION, items: {} };
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return { v: VERSION, items: {} };
    const data = JSON.parse(raw) as StorePayload;
    if (data.v !== VERSION || !data.items || typeof data.items !== "object") {
      return { v: VERSION, items: {} };
    }
    return data;
  } catch {
    return { v: VERSION, items: {} };
  }
}

function writeStore(payload: StorePayload): void {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / modo privado
  }
}

function pruneExpiredItems(items: Record<string, StoredItem>): Record<string, StoredItem> {
  const now = Date.now();
  const next: Record<string, StoredItem> = {};
  for (const [key, entry] of Object.entries(items)) {
    if (!entry || typeof entry.savedAt !== "number") continue;
    if (now - entry.savedAt > CARDTRADER_CART_META_TTL_MS) continue;
    if (!entry.meta || typeof entry.meta !== "object") continue;
    next[key] = entry;
  }
  return next;
}

export function mergeCartItemMeta(
  base: CardtraderCartItemMeta | undefined,
  patch: CardtraderCartItemMeta,
): CardtraderCartItemMeta {
  const pick = <T>(next: T | undefined, prev: T | undefined): T | undefined =>
    next !== undefined && next !== null && next !== "" ? next : prev;

  return {
    name: pick(patch.name, base?.name),
    expansion: pick(patch.expansion, base?.expansion),
    condition: pick(patch.condition, base?.condition),
    language: pick(patch.language, base?.language),
    collectorNumber: pick(patch.collectorNumber, base?.collectorNumber),
    blueprintId: pick(patch.blueprintId, base?.blueprintId),
    imageUrl: pick(patch.imageUrl, base?.imageUrl),
    imageDataUrl: pick(patch.imageDataUrl, base?.imageDataUrl),
    rarity: pick(patch.rarity, base?.rarity),
    pvpPropioCop:
      patch.pvpPropioCop !== undefined ? patch.pvpPropioCop : base?.pvpPropioCop,
  };
}

/** Carga todo el caché vigente (≤ 48 h por ítem). */
export function loadCardtraderCartMetaCache(): Record<number, CardtraderCartItemMeta> {
  const store = readStore();
  const pruned = pruneExpiredItems(store.items);
  if (Object.keys(pruned).length !== Object.keys(store.items).length) {
    writeStore({ v: VERSION, items: pruned });
  }
  const out: Record<number, CardtraderCartItemMeta> = {};
  for (const [key, entry] of Object.entries(pruned)) {
    const id = Number(key);
    if (!Number.isFinite(id)) continue;
    out[id] = entry.meta;
  }
  return out;
}

export function upsertCardtraderCartMeta(
  productId: number,
  meta: CardtraderCartItemMeta,
): CardtraderCartItemMeta {
  const store = readStore();
  const pruned = pruneExpiredItems(store.items);
  const key = String(productId);
  const merged = mergeCartItemMeta(pruned[key]?.meta, meta);
  pruned[key] = { savedAt: Date.now(), meta: merged };
  writeStore({ v: VERSION, items: pruned });
  return merged;
}

export function buildCartMetaFromOffer(args: {
  product: {
    id: number;
    name_en?: string;
    blueprint_id?: number;
    properties_hash?: Record<string, unknown>;
  };
  blueprint?: {
    id: number;
    image_url?: string | null;
    fixed_properties?: {
      collector_number?: string;
      pokemon_rarity?: string;
      mtg_rarity?: string;
      rarity?: string;
    };
  } | null;
  expansion?: { name_en?: string; name?: string } | null;
  blueprintImageUrl?: string;
}): CardtraderCartItemMeta {
  const props = args.product.properties_hash;
  const languageRaw = props?.pokemon_language ?? props?.mtg_language ?? props?.language;
  const conditionRaw = props?.condition ?? props?.pokemon_condition;
  const fixed = args.blueprint?.fixed_properties;
  const rarityRaw =
    fixed?.pokemon_rarity ?? fixed?.mtg_rarity ?? fixed?.rarity ?? props?.pokemon_rarity;

  const expansionName = args.expansion?.name_en ?? args.expansion?.name;
  const imageUrl =
    args.blueprint?.image_url?.trim() ||
    args.blueprintImageUrl?.trim() ||
    undefined;

  return {
    name: args.product.name_en?.trim() || undefined,
    expansion: typeof expansionName === "string" ? expansionName : undefined,
    condition: typeof conditionRaw === "string" ? conditionRaw : undefined,
    language:
      typeof languageRaw === "string" ? String(languageRaw).trim().toUpperCase() : undefined,
    collectorNumber:
      typeof fixed?.collector_number === "string" && fixed.collector_number.trim()
        ? fixed.collector_number.trim()
        : undefined,
    blueprintId: args.product.blueprint_id ?? args.blueprint?.id,
    imageUrl,
    rarity: typeof rarityRaw === "string" && rarityRaw.trim() ? rarityRaw.trim() : undefined,
  };
}
