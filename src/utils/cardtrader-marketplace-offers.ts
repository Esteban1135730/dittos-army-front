import { matchesOfferExtrasFilter } from "./cardtrader-offer-extras";
import { readCtLanguage } from "./cardtrader-order-item-map";

/** Helpers compartidos para listados marketplace CardTrader (ofertas / productos). */

export type CtMarketplaceProduct = {
  id: number;
  name_en?: string;
  blueprint_id?: number;
  price?: { cents?: number; currency?: string; formatted?: string };
  quantity?: number;
  properties_hash?: Record<string, unknown>;
  on_vacation?: boolean;
  expansion?: { id?: number; name_en?: string; name?: string; code?: string };
};

export type CtBlueprintSummary = {
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

export function firstProductList(data: unknown): CtMarketplaceProduct[] {
  if (!data || typeof data !== "object") return [];
  for (const v of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      return v.filter(
        (x): x is CtMarketplaceProduct =>
          !!x && typeof x === "object" && typeof (x as CtMarketplaceProduct).id === "number",
      );
    }
  }
  return [];
}

export function expansionIdFromProducts(products: CtMarketplaceProduct[]): number | null {
  for (const p of products) {
    const id = p.expansion?.id;
    if (typeof id === "number" && id > 0) return id;
  }
  return null;
}

export function productUsd(p: CtMarketplaceProduct): number {
  return (p.price?.cents ?? 0) / 100;
}

export function productConditionLabel(p: CtMarketplaceProduct): string {
  const raw = p.properties_hash?.condition ?? p.properties_hash?.pokemon_condition;
  return typeof raw === "string" ? raw : "—";
}

export function productLanguageLabel(p: CtMarketplaceProduct): string {
  const lang = readCtLanguage(p.properties_hash);
  return lang === "—" ? "—" : lang.toUpperCase();
}

function productLangRaw(p: CtMarketplaceProduct): string | null {
  const lang = readCtLanguage(p.properties_hash);
  return lang === "—" ? null : lang;
}

export function productConditionValue(p: CtMarketplaceProduct): string | null {
  const raw = p.properties_hash?.condition ?? p.properties_hash?.pokemon_condition;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function productLanguageValue(p: CtMarketplaceProduct): string | null {
  const raw = productLangRaw(p);
  return raw ? raw.toLowerCase() : null;
}

export function matchesOfferFilters(
  p: CtMarketplaceProduct,
  conditions: string[],
  languages: string[],
  maxUsd?: number | null,
  minUsd?: number | null,
  extraFacetIds?: string[],
): boolean {
  if (conditions.length > 0) {
    const cond = productConditionValue(p);
    if (!cond || !conditions.includes(cond)) return false;
  }
  if (languages.length > 0) {
    const lang = productLanguageValue(p);
    if (!lang || !languages.includes(lang)) return false;
  }
  if (extraFacetIds && extraFacetIds.length > 0 && !matchesOfferExtrasFilter(p, extraFacetIds)) {
    return false;
  }
  const usd = productUsd(p);
  if (maxUsd != null && usd > maxUsd + 0.001) return false;
  if (minUsd != null && usd < minUsd - 0.001) return false;
  return true;
}

export function uniqueFacetValues(
  products: CtMarketplaceProduct[],
  pick: (p: CtMarketplaceProduct) => string | null,
): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const v = pick(p);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function normalizeBlueprints(data: unknown): CtBlueprintSummary[] {
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is CtBlueprintSummary =>
        !!x && typeof x === "object" && typeof (x as CtBlueprintSummary).id === "number",
    );
  }
  return [];
}

export function conditionChipSx(condition: string): { bgcolor: string; color: string } {
  const c = condition.toLowerCase();
  if (c.includes("near mint")) {
    return { bgcolor: "#2e7d32", color: "#fff" };
  }
  if (c.includes("poor")) {
    return { bgcolor: "#c62828", color: "#fff" };
  }
  if (
    c.includes("good") ||
    c.includes("lightly") ||
    c.includes("erately") ||
    c.includes("played") ||
    c.includes("moderate")
  ) {
    return { bgcolor: "#f9a825", color: "#1a1a1a" };
  }
  return { bgcolor: "#e0e0e0", color: "#424242" };
}

export function arraysEqualSorted(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
