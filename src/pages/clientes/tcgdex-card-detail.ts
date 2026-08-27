import axios from "axios";
import { apiUrl } from "../../config/api";
import { buildTcgdexCardIdLookupCandidates } from "../../utils/tcgdex-set-resolve";
import { expansionFromCardDto } from "./mensaje-reserva-pedido";

const API_TCG_FIND = apiUrl("/tcg-dex/card/find");

/** Índice serializable (React Query persiste en localStorage; Map no). */
export type TcgdexDetailsByCardId = Record<string, TcgdexCardDetail>;

export type TcgdexCardDetail = {
  id: string;
  name: string;
  imageUrl: string;
  imageLargeUrl: string;
  rarity: string;
  category: string;
  setLabel: string;
  localId?: string;
  types?: string[];
  illustrator?: string;
  regulationMark?: string;
  hp?: number;
  stage?: string;
  legalStandard?: boolean;
};

type TcgdexCardApi = {
  id?: string;
  localId?: string;
  name?: string;
  rarity?: string;
  category?: string;
  set?: string;
  setEnglishName?: string;
  image?: string;
  images?: { small?: string; large?: string };
  types?: string[];
  illustrator?: string;
  regulationMark?: string;
  hp?: number;
  stage?: string;
  legal?: { standard?: boolean };
};

/** Formato set-local TCGdex (set con dígito + número local). */
export function looksLikeTcgdexCardId(id: string | null | undefined): boolean {
  if (!id?.trim()) return false;
  const trimmed = id.trim();
  const dash = trimmed.lastIndexOf("-");
  if (dash <= 0 || dash >= trimmed.length - 1) return false;
  const setPart = trimmed.slice(0, dash);
  const localPart = trimmed.slice(dash + 1);
  return (
    /\d/.test(setPart) &&
    /^[a-z0-9.]+$/i.test(setPart) &&
    /^[a-z0-9_]+$/i.test(localPart)
  );
}

export function tcgdxCardIdCandidates(cardId: string, language?: string | null): string[] {
  const trimmed = cardId.trim();
  if (!trimmed) return [];
  const candidates = buildTcgdexCardIdLookupCandidates(trimmed, language);
  return candidates.length > 0 ? candidates : [trimmed];
}

export function mapTcgdexApiToDetail(raw: TcgdexCardApi | null | undefined): TcgdexCardDetail | null {
  if (!raw?.id?.trim() && !raw?.name?.trim()) return null;
  const imageUrl =
    raw.images?.small?.trim() ||
    raw.image?.trim() ||
    "";
  const imageLargeUrl =
    raw.images?.large?.trim() ||
    raw.image?.trim() ||
    imageUrl;
  const setLabel = expansionFromCardDto(raw) ?? "";
  const id = raw.id?.trim() || "";
  return {
    id,
    name: raw.name?.trim() || id,
    imageUrl,
    imageLargeUrl,
    rarity: raw.rarity?.trim() || "",
    category: raw.category?.trim() || "",
    setLabel,
    localId: raw.localId?.trim() || undefined,
    types: raw.types?.length ? raw.types : undefined,
    illustrator: raw.illustrator?.trim() || undefined,
    regulationMark: raw.regulationMark?.trim() || undefined,
    hp: raw.hp,
    stage: raw.stage?.trim() || undefined,
    legalStandard: raw.legal?.standard,
  };
}

export async function fetchTcgdexCardDetail(
  cardId: string,
  language?: string | null,
): Promise<TcgdexCardDetail | null> {
  if (!looksLikeTcgdexCardId(cardId)) return null;
  for (const candidate of tcgdxCardIdCandidates(cardId, language)) {
    try {
      const res = await axios.get<TcgdexCardApi>(
        `${API_TCG_FIND}/${encodeURIComponent(candidate)}`,
      );
      const detail = mapTcgdexApiToDetail(res.data);
      if (detail) return detail;
    } catch {
      /* probar siguiente variante normalizada */
    }
  }
  return null;
}

export async function fetchTcgdexCardDetailsMap(
  cardIds: string[],
  language?: string | null,
): Promise<TcgdexDetailsByCardId> {
  const unique = [
    ...new Set(
      cardIds.map((id) => id?.trim()).filter(looksLikeTcgdexCardId) as string[],
    ),
  ];
  const map: TcgdexDetailsByCardId = {};
  await Promise.all(
    unique.map(async (originalId) => {
      const detail = await fetchTcgdexCardDetail(originalId, language);
      if (!detail) return;
      map[originalId] = detail;
      for (const alias of buildTcgdexCardIdLookupCandidates(originalId, language)) {
        map[alias] = detail;
      }
    }),
  );
  return map;
}

function getTcgdexDetailEntry(
  map: TcgdexDetailsByCardId | Map<string, TcgdexCardDetail>,
  key: string,
): TcgdexCardDetail | undefined {
  if (map instanceof Map) return map.get(key);
  return map[key];
}

export function collectTcgdexIdsFromLines(
  lines: Array<{ card_id?: string | null }>,
): string[] {
  return [
    ...new Set(
      lines.map((l) => l.card_id?.trim()).filter(looksLikeTcgdexCardId) as string[],
    ),
  ];
}

export function lookupTcgdexDetail(
  cardId: string | null | undefined,
  map: TcgdexDetailsByCardId | Map<string, TcgdexCardDetail>,
  language?: string | null,
): TcgdexCardDetail | undefined {
  if (!cardId?.trim()) return undefined;
  const trimmed = cardId.trim();
  const direct = getTcgdexDetailEntry(map, trimmed);
  if (direct) return direct;
  for (const candidate of tcgdxCardIdCandidates(trimmed, language)) {
    const hit = getTcgdexDetailEntry(map, candidate);
    if (hit) return hit;
  }
  return undefined;
}

/** Imagen guardada, o miniatura TCGdex si el lote no trae URL. */
export function resolveCardImageSrc(
  cardId: string | null | undefined,
  imageUrl: string | null | undefined,
  details: TcgdexDetailsByCardId | Map<string, TcgdexCardDetail>,
  language?: string | null,
): string {
  const stored = String(imageUrl ?? "").trim();
  if (stored) return stored;
  return lookupTcgdexDetail(cardId, details, language)?.imageUrl?.trim() ?? "";
}
