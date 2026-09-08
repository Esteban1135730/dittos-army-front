import { describe, expect, it } from "vitest";
import {
  filterStockInReservaCatalog,
  isStockLineInReservaCatalog,
  sortReservaCatalogRows,
} from "./stock-reserva-catalog";

describe("isStockLineInReservaCatalog", () => {
  it("oculta vendida, propiedad y unidades en reserva", () => {
    expect(
      isStockLineInReservaCatalog({ card_state: "disponible", card_id: "x" }),
    ).toBe(true);
    expect(
      isStockLineInReservaCatalog({ card_state: "vendida", card_id: "x" }),
    ).toBe(false);
    expect(
      isStockLineInReservaCatalog({ card_state: "propiedad", card_id: "x" }),
    ).toBe(false);
    expect(
      isStockLineInReservaCatalog({ card_state: "reserva", card_id: "x" }),
    ).toBe(false);
  });

  it("muestra bulk con cantidad aunque el estado legado sea reserva", () => {
    expect(
      isStockLineInReservaCatalog({
        card_state: "reserva",
        card_id: "da-bulk",
        product_kind: "quantity",
        quantity: 12,
      }),
    ).toBe(true);
    expect(
      isStockLineInReservaCatalog({
        card_state: "disponible",
        card_id: "da-bulk",
        product_kind: "quantity",
        quantity: 0,
      }),
    ).toBe(false);
  });
});

describe("filterStockInReservaCatalog / sortReservaCatalogRows", () => {
  it("deja bulk, envio, domicilio y proteccion primero entre las filas visibles", () => {
    const rows = [
      { _id: "1", card_id: "sv1-1", card_state: "disponible" },
      {
        _id: "2",
        card_id: "da-bulk",
        card_state: "disponible",
        product_kind: "quantity" as const,
        quantity: 9,
      },
      { _id: "3", card_id: "sv1-2", card_state: "reserva" },
      {
        _id: "4",
        card_id: "da-proteccion-cartas",
        card_state: "disponible",
        product_kind: "quantity" as const,
        quantity: 5,
      },
      {
        _id: "5",
        card_id: "da-envio",
        card_state: "disponible",
        product_kind: "quantity" as const,
        quantity: 5,
      },
      {
        _id: "6",
        card_id: "da-domicilio",
        card_state: "disponible",
        product_kind: "quantity" as const,
        quantity: 5,
      },
    ];
    const filtered = sortReservaCatalogRows(filterStockInReservaCatalog(rows));
    expect(filtered.map((r) => r._id)).toEqual(["2", "5", "6", "4", "1"]);
  });
});
