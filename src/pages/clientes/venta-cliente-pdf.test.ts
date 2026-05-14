import { describe, expect, it } from "vitest";
import {
  buildReservaGroupKey,
  buildVentaPdfFilename,
  compareVentaPdfGroups,
  groupReservasForVentaPdf,
  reservaPrecioToCop,
  slugClienteForFilename,
  totalCopFromGroups,
  type VentaPdfGroupRow,
} from "./venta-cliente-pdf";

const stockById = {
  s1: {
    card_id: "card-b",
    card_name: "Bulbasaur",
    rareza: "Common",
    image_url: "https://example.com/b.png",
  },
  s2: {
    card_id: "card-a",
    card_name: "Abra",
    rareza: "Rare",
    image_url: "https://example.com/a.png",
  },
  s3: {
    card_id: "card-b",
    card_name: "Bulbasaur",
    rareza: "Common",
    image_url: "https://example.com/b.png",
  },
};

describe("reservaPrecioToCop", () => {
  it("redondea precios en COP", () => {
    expect(reservaPrecioToCop(12_345.6, "COP")).toBe(12_346);
  });
});

describe("buildReservaGroupKey", () => {
  it("diferencia precio unitario para la misma carta", () => {
    const low = buildReservaGroupKey("card-b", "Common", 10_000, "COP");
    const high = buildReservaGroupKey("card-b", "Common", 12_000, "COP");
    expect(low).not.toBe(high);
  });
});

describe("groupReservasForVentaPdf", () => {
  it("agrupa líneas iguales y calcula cantidad y lote", () => {
    const groups = groupReservasForVentaPdf(
      [
        { stock_id: "s1", precio: 10_000, currency: "COP" },
        { stock_id: "s3", precio: 10_000, currency: "COP" },
      ],
      stockById,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      card_id: "card-b",
      quantity: 2,
      unitPriceCop: 10_000,
      lineTotalCop: 20_000,
    });
  });

  it("no agrupa la misma carta con precios distintos", () => {
    const groups = groupReservasForVentaPdf(
      [
        { stock_id: "s1", precio: 10_000, currency: "COP" },
        { stock_id: "s3", precio: 12_000, currency: "COP" },
      ],
      stockById,
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.unitPriceCop).sort((a, b) => a - b)).toEqual([10_000, 12_000]);
  });

  it("incluye precio 0 en el total", () => {
    const groups = groupReservasForVentaPdf(
      [{ stock_id: "s2", precio: 0, currency: "COP" }],
      stockById,
    );

    expect(groups[0].unitPriceCop).toBe(0);
    expect(totalCopFromGroups(groups)).toBe(0);
  });

  it("ordena alfabéticamente por nombre de carta", () => {
    const groups = groupReservasForVentaPdf(
      [
        { stock_id: "s1", precio: 10_000, currency: "COP" },
        { stock_id: "s2", precio: 5_000, currency: "COP" },
      ],
      stockById,
    );

    expect(groups.map((g) => g.card_name)).toEqual(["Abra", "Bulbasaur"]);
  });
});

describe("compareVentaPdfGroups", () => {
  it("desempata por rareza y precio", () => {
    const rows: VentaPdfGroupRow[] = [
      {
        card_id: "x",
        card_name: "Pikachu",
        rareza: "Rare",
        quantity: 1,
        unitPriceCop: 8_000,
        lineTotalCop: 8_000,
      },
      {
        card_id: "x",
        card_name: "Pikachu",
        rareza: "Common",
        quantity: 1,
        unitPriceCop: 5_000,
        lineTotalCop: 5_000,
      },
    ];

    expect([...rows].sort(compareVentaPdfGroups).map((r) => r.rareza)).toEqual(["Common", "Rare"]);
  });
});

describe("buildVentaPdfFilename", () => {
  it("sanitiza el nombre del cliente y conserva la fecha", () => {
    expect(
      buildVentaPdfFilename("María Pérez / VIP", new Date("2026-05-14T15:00:00")),
    ).toBe("venta-maria-perez-vip-20260514.pdf");
  });

  it("usa un slug por defecto si el nombre queda vacío", () => {
    expect(slugClienteForFilename("***")).toBe("cliente");
  });
});
