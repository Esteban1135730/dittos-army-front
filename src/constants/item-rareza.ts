/**
 * Variantes operativas (mismo catálogo que `dittos-army-back/src/constants/item-rareza.ts`).
 */
export const OPERATIONAL_RAREZA_VALUES = [
  "hollow",
  "foil",
  "pokeball",
  "masterball",
  "first edition",
  "holofoil",
  "league card",
] as const;

export type OperationalRareza = (typeof OPERATIONAL_RAREZA_VALUES)[number];

const RAREZA_LABELS: Record<OperationalRareza, string> = {
  hollow: "Hollow",
  foil: "Foil",
  pokeball: "Pokeball",
  masterball: "Masterball",
  "first edition": "First edition",
  holofoil: "Holofoil",
  "league card": "Carta de liga",
};

function normalizeRarezaInput(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim().toLowerCase();
}

function normalizeRarezaCatalogKey(rz: string | null): string | null {
  if (rz === null) return null;
  if (rz === "league_card") return "league card";
  return rz;
}

/** Valor canónico para agrupar / API (trim, minúsculas, alias). */
export function normalizeOperationalRareza(raw: string | null | undefined): string | null {
  return normalizeRarezaCatalogKey(normalizeRarezaInput(raw));
}

export function operationalRarezaLabel(
  value: string | null | undefined,
): string {
  if (value == null || value === "") {
    return "Sin variante (precio general)";
  }
  return RAREZA_LABELS[value as OperationalRareza] ?? value;
}
