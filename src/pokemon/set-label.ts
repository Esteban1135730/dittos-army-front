export type TcgCardLite = {
  set?: string;
  name?: string;
  /** Nombre EN del set cuando el catálogo localizado no es inglés. */
  setEnglishName?: string;
};

/** Nombre de expansión visible a partir del DTO de TCGdex. */
export function expansionFromCardDto(
  card: TcgCardLite | null | undefined,
): string | undefined {
  const english = card?.setEnglishName?.trim();
  if (english) return english;
  if (!card?.set) return undefined;
  const s = String(card.set);
  const m = s.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : s.trim();
}
