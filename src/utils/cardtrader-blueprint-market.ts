export type BlueprintMarketPrice = {
  cents: number;
  currency: string;
  formatted?: string;
};

type PriceLike = {
  cents?: number;
  currency?: string;
  formatted?: string;
};

function readPriceLike(value: unknown): BlueprintMarketPrice | null {
  if (!value || typeof value !== "object") return null;
  const p = value as PriceLike;
  if (typeof p.cents !== "number" || !Number.isFinite(p.cents) || p.cents < 0) {
    return null;
  }
  return {
    cents: Math.round(p.cents),
    currency: typeof p.currency === "string" && p.currency.trim() ? p.currency.trim() : "USD",
    formatted: typeof p.formatted === "string" ? p.formatted : undefined,
  };
}

/** Precio en el objeto blueprint si CardTrader lo incluye (p. ej. export enriquecido). */
export function extractBlueprintListPrice(blueprint: unknown): BlueprintMarketPrice | null {
  if (!blueprint || typeof blueprint !== "object") return null;
  const raw = blueprint as Record<string, unknown>;
  const fromPrice = readPriceLike(raw.price);
  if (fromPrice) return fromPrice;
  const fromSeller = readPriceLike(raw.seller_price);
  if (fromSeller) return fromSeller;
  if (typeof raw.price_cents === "number" && Number.isFinite(raw.price_cents)) {
    return {
      cents: Math.round(raw.price_cents),
      currency:
        typeof raw.price_currency === "string" && raw.price_currency.trim()
          ? raw.price_currency.trim()
          : "USD",
      formatted:
        typeof raw.formatted_price === "string" ? raw.formatted_price : undefined,
    };
  }
  return null;
}

type MarketplaceProductLike = {
  price?: PriceLike;
  price_cents?: number;
  price_currency?: string;
};

function readProductPrice(product: MarketplaceProductLike): BlueprintMarketPrice | null {
  const fromPrice = readPriceLike(product.price);
  if (fromPrice) return fromPrice;
  if (typeof product.price_cents === "number" && Number.isFinite(product.price_cents)) {
    return {
      cents: Math.round(product.price_cents),
      currency:
        typeof product.price_currency === "string" && product.price_currency.trim()
          ? product.price_currency.trim()
          : "USD",
    };
  }
  return null;
}

/**
 * Precio más bajo por blueprint desde `GET marketplace/products` (clave = blueprint id).
 * Cada array de productos viene ordenado por precio ascendente; usamos el primero.
 */
export function minPricesByBlueprintFromMarketplace(
  data: unknown,
): Map<number, BlueprintMarketPrice> {
  const map = new Map<number, BlueprintMarketPrice>();
  if (!data || typeof data !== "object" || Array.isArray(data)) return map;

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const blueprintId = Number(key);
    if (!Number.isFinite(blueprintId)) continue;
    if (!Array.isArray(value) || value.length === 0) continue;
    const first = value[0];
    if (!first || typeof first !== "object") continue;
    const price = readProductPrice(first as MarketplaceProductLike);
    if (price) map.set(blueprintId, price);
  }
  return map;
}

export function formatBlueprintMarketPrice(price: BlueprintMarketPrice): string {
  if (price.formatted?.trim()) return price.formatted.trim();
  const amount = price.cents / 100;
  const cur = price.currency.trim().toUpperCase() || "USD";
  return `${amount.toFixed(2)} ${cur}`;
}

export type BlueprintPriceSort = "asc" | "desc";

export function extractBlueprintRarity(blueprint: unknown): string | null {
  if (!blueprint || typeof blueprint !== "object") return null;
  const fixed = (blueprint as { fixed_properties?: Record<string, unknown> }).fixed_properties;
  if (!fixed || typeof fixed !== "object") return null;
  const raw =
    fixed.pokemon_rarity ?? fixed.mtg_rarity ?? fixed.rarity ?? fixed.fab_rarity;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim();
}

function readProductRarity(product: Record<string, unknown>): string | null {
  const props = product.properties_hash;
  if (!props || typeof props !== "object") return null;
  const hash = props as Record<string, unknown>;
  const raw =
    hash.pokemon_rarity ?? hash.mtg_rarity ?? hash.rarity ?? hash.fab_rarity;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim();
}

/** Rareza por blueprint desde el primer producto del marketplace (fallback). */
export function raritiesByBlueprintFromMarketplace(data: unknown): Map<number, string> {
  const map = new Map<number, string>();
  if (!data || typeof data !== "object" || Array.isArray(data)) return map;

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const blueprintId = Number(key);
    if (!Number.isFinite(blueprintId)) continue;
    if (!Array.isArray(value) || value.length === 0) continue;
    const first = value[0];
    if (!first || typeof first !== "object") continue;
    const rarity = readProductRarity(first as Record<string, unknown>);
    if (rarity) map.set(blueprintId, rarity);
  }
  return map;
}

export function normalizeRarityKey(rarity: string): string {
  return rarity.trim().toLowerCase();
}

export function parseUsdFilterToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

type UsdConversion = {
  toCopFromEur?: (value: number) => number | null;
  toCopFromUsd?: (value: number) => number | null;
};

/** Convierte precio de mercado a centavos USD para filtrar/ordenar de forma comparable. */
export function marketPriceToUsdCents(
  price: BlueprintMarketPrice,
  copPerUsd: number | null,
  convert?: UsdConversion,
): number | null {
  const cur = price.currency.trim().toUpperCase() || "USD";
  if (cur === "USD") return price.cents;
  if (cur === "EUR" && convert?.toCopFromEur && copPerUsd && copPerUsd > 0) {
    const cop = convert.toCopFromEur(price.cents / 100);
    if (cop === null) return null;
    return Math.round((cop / copPerUsd) * 100);
  }
  if (cur === "COP" && copPerUsd && copPerUsd > 0) {
    return Math.round((price.cents / 100 / copPerUsd) * 100);
  }
  if (convert?.toCopFromUsd && copPerUsd && copPerUsd > 0) {
    const cop = convert.toCopFromUsd(price.cents / 100);
    if (cop === null) return null;
    return Math.round((cop / copPerUsd) * 100);
  }
  return price.cents;
}

export function blueprintMatchesPriceFilter(
  usdCents: number | null,
  minUsdCents: number | null,
  maxUsdCents: number | null,
): boolean {
  if (minUsdCents === null && maxUsdCents === null) return true;
  if (usdCents === null) return false;
  if (minUsdCents !== null && usdCents < minUsdCents) return false;
  if (maxUsdCents !== null && usdCents > maxUsdCents) return false;
  return true;
}

export function blueprintMatchesRarityFilter(
  rarity: string | null | undefined,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  if (!rarity?.trim()) return false;
  const key = normalizeRarityKey(rarity);
  return selected.some((s) => normalizeRarityKey(s) === key);
}

export function compareBlueprintsByMarketPrice(
  blueprintIdA: number,
  blueprintIdB: number,
  prices: Map<number, BlueprintMarketPrice>,
  nameA: string,
  nameB: string,
  options?: {
    direction?: BlueprintPriceSort;
    usdCentsByBlueprintId?: Map<number, number>;
    copPerUsd?: number | null;
    convert?: UsdConversion;
  },
): number {
  const direction = options?.direction ?? "asc";
  const usdMap = options?.usdCentsByBlueprintId;

  const resolveUsdCents = (id: number): number => {
    if (usdMap?.has(id)) return usdMap.get(id)!;
    const price = prices.get(id);
    if (!price) return Number.POSITIVE_INFINITY;
    return (
      marketPriceToUsdCents(price, options?.copPerUsd ?? null, options?.convert) ??
      Number.POSITIVE_INFINITY
    );
  };

  const centsA = resolveUsdCents(blueprintIdA);
  const centsB = resolveUsdCents(blueprintIdB);
  if (centsA !== centsB) {
    return direction === "desc" ? centsB - centsA : centsA - centsB;
  }
  return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
}
