/** CardTrader `game_id` values (GET /games). */
export const CARDTRADER_POKEMON_GAME_ID = 5;
export const CARDTRADER_YUGIOH_GAME_ID = 4;

export type CardTraderGameId =
  | typeof CARDTRADER_POKEMON_GAME_ID
  | typeof CARDTRADER_YUGIOH_GAME_ID;

export function cardTraderGameIdForTcg(
  tcg: "pokemon" | "yugioh",
): CardTraderGameId {
  return tcg === "yugioh"
    ? CARDTRADER_YUGIOH_GAME_ID
    : CARDTRADER_POKEMON_GAME_ID;
}
