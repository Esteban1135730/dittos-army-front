import type { CtMarketplaceProduct } from "./cardtrader-marketplace-offers";
import {
  CT_CONDITION_KEYS,
  CT_LANGUAGE_KEYS,
  CT_RARITY_KEYS,
} from "./cardtrader-order-item-map";

/** Claves de properties_hash que no son “extras” (estado, idioma, metadatos de carta). */
const NON_EXTRA_KEYS = new Set<string>([
  ...CT_CONDITION_KEYS,
  ...CT_LANGUAGE_KEYS,
  ...CT_RARITY_KEYS,
  "collector_number",
  "cmc",
  "tournament_legal",
  "mtg_card_colors",
  "pitch_value",
  "fab_faction",
  "meta_name",
  "expansion_id",
  "expansion_code",
]);

type ExtraSpec = {
  id: string;
  label: string;
  keys: string[];
  matches: (value: unknown) => boolean;
};

function isActiveTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (!s || s === "false" || s === "no" || s === "none" || s === "0") return false;
    return true;
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

const KNOWN_EXTRA_SPECS: ExtraSpec[] = [
  {
    id: "first_edition",
    label: "First Edition",
    keys: ["first_edition"],
    matches: isActiveTruthy,
  },
  {
    id: "reverse",
    label: "Reverse Holo",
    keys: ["reverse", "pokemon_reverse", "reverse_holo", "poke_ball_reverse_holo", "master_ball_reverse_holo"],
    matches: isActiveTruthy,
  },
  {
    id: "foil",
    label: "Foil",
    keys: ["foil", "mtg_foil", "fab_foil", "pokemon_foil", "holofoil"],
    matches: isActiveTruthy,
  },
  {
    id: "signed",
    label: "Signed",
    keys: ["signed"],
    matches: (v) => v === true,
  },
  {
    id: "altered",
    label: "Altered",
    keys: ["altered"],
    matches: (v) => v === true,
  },
  {
    id: "graded",
    label: "Graded",
    keys: ["graded"],
    matches: (v) => v === true,
  },
];

function humanizeExtraKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function discoverExtraFromEntry(key: string, value: unknown): { id: string; label: string } | null {
  if (NON_EXTRA_KEYS.has(key)) return null;
  if (!isActiveTruthy(value)) return null;

  for (const spec of KNOWN_EXTRA_SPECS) {
    if (spec.keys.includes(key)) return { id: spec.id, label: spec.label };
  }

  if (typeof value === "string" && value.trim()) {
    return { id: `raw:${key}`, label: `${humanizeExtraKey(key)}: ${value.trim()}` };
  }
  return { id: `raw:${key}`, label: humanizeExtraKey(key) };
}

/** IDs estables de extras activos en la oferta (para filtros). */
export function productOfferExtraFacetIds(p: CtMarketplaceProduct): string[] {
  const hash = p.properties_hash;
  if (!hash || typeof hash !== "object") return [];

  const ids = new Set<string>();

  for (const spec of KNOWN_EXTRA_SPECS) {
    for (const key of spec.keys) {
      if (key in hash && spec.matches(hash[key])) {
        ids.add(spec.id);
        break;
      }
    }
  }

  for (const [key, value] of Object.entries(hash)) {
    if (ids.has(key)) continue;
    const discovered = discoverExtraFromEntry(key, value);
    if (discovered) ids.add(discovered.id);
  }

  return [...ids];
}

/** Etiquetas legibles para la tabla. */
export function productOfferExtraLabels(p: CtMarketplaceProduct): string[] {
  const hash = p.properties_hash;
  if (!hash || typeof hash !== "object") return [];

  const labels: string[] = [];
  const seen = new Set<string>();

  const add = (label: string) => {
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  };

  for (const spec of KNOWN_EXTRA_SPECS) {
    for (const key of spec.keys) {
      if (key in hash && spec.matches(hash[key])) {
        add(spec.label);
        break;
      }
    }
  }

  for (const [key, value] of Object.entries(hash)) {
    const discovered = discoverExtraFromEntry(key, value);
    if (!discovered) continue;
    if (KNOWN_EXTRA_SPECS.some((s) => s.id === discovered.id)) continue;
    add(discovered.label);
  }

  return labels;
}

export type OfferExtraFacetOption = { id: string; label: string };

export function availableOfferExtraFacets(products: CtMarketplaceProduct[]): OfferExtraFacetOption[] {
  const byId = new Map<string, string>();

  for (const p of products) {
    for (const id of productOfferExtraFacetIds(p)) {
      if (byId.has(id)) continue;
      const spec = KNOWN_EXTRA_SPECS.find((s) => s.id === id);
      if (spec) {
        byId.set(id, spec.label);
        continue;
      }
      const hash = p.properties_hash ?? {};
      for (const [key, value] of Object.entries(hash)) {
        const d = discoverExtraFromEntry(key, value);
        if (d?.id === id) {
          byId.set(id, d.label);
          break;
        }
      }
    }
  }

  return [...byId.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function extraFacetLabel(facetId: string): string {
  const spec = KNOWN_EXTRA_SPECS.find((s) => s.id === facetId);
  if (spec) return spec.label;
  if (facetId.startsWith("raw:")) {
    return humanizeExtraKey(facetId.slice(4));
  }
  return facetId;
}

export function matchesOfferExtrasFilter(p: CtMarketplaceProduct, selectedExtraIds: string[]): boolean {
  if (selectedExtraIds.length === 0) return true;
  const ids = productOfferExtraFacetIds(p);
  return selectedExtraIds.some((id) => ids.includes(id));
}

export function extraChipSx(extraLabel: string): { bgcolor: string; color: string } {
  const l = extraLabel.toLowerCase();
  if (l.includes("first")) return { bgcolor: "#4a148c", color: "#fff" };
  if (l.includes("pokeball") || l.includes("masterball") || l.includes("reverse")) {
    return { bgcolor: "#1565c0", color: "#fff" };
  }
  if (l.includes("foil") || l.includes("holo") || l.includes("hollow")) {
    return { bgcolor: "#e65100", color: "#fff" };
  }
  return { bgcolor: "#eceff1", color: "#37474f" };
}
