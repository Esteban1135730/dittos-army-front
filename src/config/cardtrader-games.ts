import type { TcgKey } from "./owners";

/** CardTrader `game_id` values (GET /games). */
export const CARDTRADER_MAGIC_GAME_ID = 1;
export const CARDTRADER_YUGIOH_GAME_ID = 4;
export const CARDTRADER_POKEMON_GAME_ID = 5;
export const CARDTRADER_ONEPIECE_GAME_ID = 15;

export const CARDTRADER_GAME_ID_BY_TCG = {
  pokemon: CARDTRADER_POKEMON_GAME_ID,
  yugioh: CARDTRADER_YUGIOH_GAME_ID,
  magic: CARDTRADER_MAGIC_GAME_ID,
  onepiece: CARDTRADER_ONEPIECE_GAME_ID,
} as const satisfies Record<TcgKey, number>;

export type CardTraderGameId =
  (typeof CARDTRADER_GAME_ID_BY_TCG)[keyof typeof CARDTRADER_GAME_ID_BY_TCG];

export function cardTraderGameIdForTcg(tcg: TcgKey): CardTraderGameId {
  return CARDTRADER_GAME_ID_BY_TCG[tcg];
}
