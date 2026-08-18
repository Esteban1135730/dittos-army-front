import type { PropertyStockItem } from "./property-types";

export function propertyCostInCop(
  stock: PropertyStockItem | undefined,
  convert: {
    toCopFromEur: (n: number) => number | null;
    toCopFromUsd: (n: number) => number | null;
  },
): number {
  if (!stock?.card_cost) return 0;
  const moneda = stock.currency;
  if (moneda === "COP") return stock.card_cost;
  if (moneda === "EUR") return convert.toCopFromEur(stock.card_cost) ?? 0;
  if (moneda === "USD") return convert.toCopFromUsd(stock.card_cost) ?? 0;
  return 0;
}

export function extractAxiosMessage(error: unknown, fallback: string): string {
  const msg = (error as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}
