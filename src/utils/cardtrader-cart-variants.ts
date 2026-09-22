/**
 * Etiquetas de variante operativa para el carrito CardTrader (cotizar).
 * Distingue pokeball / masterball / reverse / hollow / holofoil (a diferencia
 * de `productOfferExtraLabels`, que colapsa varias claves bajo “Reverse Holo”).
 */

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

/**
 * Extrae etiquetas legibles de variante desde `properties_hash` de una oferta.
 * No incluye condition / language / rarity de blueprint ni collector_number.
 *
 * Prioridad: Masterball y Pokeball por encima de Reverse genérico.
 * Puede devolver varios chips (p. ej. First edition + Reverse).
 */
export function cartVariantLabelsFromPropertiesHash(
  hash: Record<string, unknown> | null | undefined,
): string[] {
  if (!hash || typeof hash !== "object") return [];

  const labels: string[] = [];
  const add = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };

  if (isActiveTruthy(hash.first_edition)) {
    add("First edition");
  }

  const hasMasterball = isActiveTruthy(hash.master_ball_reverse_holo);
  const hasPokeball = isActiveTruthy(hash.poke_ball_reverse_holo);
  if (hasMasterball) add("Masterball");
  if (hasPokeball) add("Pokeball");

  if (
    !hasMasterball &&
    !hasPokeball &&
    (isActiveTruthy(hash.reverse) ||
      isActiveTruthy(hash.pokemon_reverse) ||
      isActiveTruthy(hash.reverse_holo))
  ) {
    add("Reverse");
  }

  if (isActiveTruthy(hash.holofoil)) {
    add("Holofoil");
  } else if (
    isActiveTruthy(hash.foil) ||
    isActiveTruthy(hash.pokemon_foil) ||
    isActiveTruthy(hash.mtg_foil) ||
    isActiveTruthy(hash.fab_foil) ||
    isActiveTruthy(hash.pokemon_holo) ||
    isActiveTruthy(hash.holo)
  ) {
    add("Hollow");
  }

  if (hash.signed === true) add("Signed");
  if (hash.altered === true) add("Altered");
  if (hash.graded === true) add("Graded");

  return labels;
}
