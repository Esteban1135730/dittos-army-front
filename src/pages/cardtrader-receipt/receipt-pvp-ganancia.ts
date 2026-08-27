import type { StockListItem } from "../../types/stock";

type CopConvert = {
  toCopFromEur: (n: number) => number | null;
  toCopFromUsd: (n: number) => number | null;
};

export function parseDraftPvpCop(draft: string): number {
  const n = parseFloat(String(draft ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

/** Costo en COP: `card_cost` (incluye envío) o `unity_cost`. */
export function stockCostCop(
  item: Pick<StockListItem, "card_cost" | "unity_cost" | "currency">,
  convert: CopConvert,
): number {
  const raw =
    typeof item.card_cost === "number" && Number.isFinite(item.card_cost)
      ? item.card_cost
      : (item.unity_cost ?? 0);
  if (item.currency === "EUR") return convert.toCopFromEur(raw) ?? 0;
  if (item.currency === "USD") return convert.toCopFromUsd(raw) ?? 0;
  return raw;
}

/** PVP − costo; `null` si aún no hay PVP. */
export function gananciaCopFromPvp(pvpCop: number, costCop: number): number | null {
  if (!(pvpCop > 0)) return null;
  return pvpCop - costCop;
}
