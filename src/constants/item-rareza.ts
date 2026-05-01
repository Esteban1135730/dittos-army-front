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

export function operationalRarezaLabel(
  value: string | null | undefined,
): string {
  if (value == null || value === "") {
    return "Sin variante (precio general)";
  }
  return RAREZA_LABELS[value as OperationalRareza] ?? value;
}
