/**
 * Cliente de catálogo Pokémon (TCGdex) para el panel.
 * Las páginas de negocio importan desde aquí.
 */
export {
  fetchTcgdexCardDetail,
  fetchTcgdexCardDetailsMap,
  looksLikeTcgdexCardId,
  lookupTcgdexDetail,
  mapTcgdexApiToDetail,
  resolveCardImageSrc,
  tcgdxCardIdCandidates,
  collectTcgdexIdsFromLines,
} from "./tcgdex-card-detail";
export type {
  TcgdexCardDetail,
  TcgdexDetailsByCardId,
} from "./tcgdex-card-detail";
export { useTcgdexCardDetails } from "./use-tcgdex-card-details";
export { expansionFromCardDto } from "./set-label";
export type { TcgCardLite } from "./set-label";
export * from "./tcgdex-set-resolve";
