import type { StockListItem } from "../../types/stock";
import type { ReservaItem } from "./cliente-types";
import { isZeroProfitCardId } from "../../constants/bulk-product";

export type CurrencyConverter = {
  toCopFromEur: (value: number) => number | null | undefined;
  toCopFromUsd: (value: number) => number | null | undefined;
};

export type ReservasTotales = {
  ventasEsperadasCop: number;
  gananciaEstimadaCop: number;
};

export function amountToCop(
  amount: number,
  currency: string,
  convert: CurrencyConverter,
): number {
  if (currency === "COP") return amount;
  if (currency === "EUR") return convert.toCopFromEur(amount) ?? 0;
  if (currency === "USD") return convert.toCopFromUsd(amount) ?? 0;
  return amount;
}

export function reservaLineQuantity(quantity?: number | null): number {
  if (typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 1) {
    return quantity;
  }
  return 1;
}

export function gananciaEstimadaReservaCop(
  precio: number,
  currency: string,
  stock: Pick<StockListItem, "currency" | "card_cost" | "card_id"> | undefined,
  convert: CurrencyConverter,
): number {
  if (isZeroProfitCardId(stock?.card_id)) return 0;
  const precioCop = amountToCop(precio, currency ?? "COP", convert);
  const costoCop = stock ? amountToCop(stock.card_cost, stock.currency, convert) : 0;
  return precioCop - costoCop;
}

export function aggregateReservasTotales(
  reservas: Pick<ReservaItem, "stock_id" | "precio" | "currency" | "quantity">[],
  stockById: Record<string, Pick<StockListItem, "currency" | "card_cost" | "card_id"> | undefined>,
  convert: CurrencyConverter,
): ReservasTotales {
  let ventasEsperadasCop = 0;
  let gananciaEstimadaCop = 0;

  for (const reserva of reservas) {
    const units = reservaLineQuantity(reserva.quantity);
    const precioCop = amountToCop(reserva.precio, reserva.currency ?? "COP", convert);
    ventasEsperadasCop += precioCop * units;
    gananciaEstimadaCop +=
      gananciaEstimadaReservaCop(
        reserva.precio,
        reserva.currency ?? "COP",
        stockById[reserva.stock_id],
        convert,
      ) * units;
  }

  return { ventasEsperadasCop, gananciaEstimadaCop };
}
