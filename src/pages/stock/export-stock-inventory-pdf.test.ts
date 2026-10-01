import { describe, expect, it } from "vitest";
import {
  buildInventoryPdfFilename,
  computeInventoryPdfGridLayout,
  filterAvailableStockForPdf,
  filterStockWithInventoryPhotosForPdf,
  fitAspectRect,
  resolveInventoryPhotoUrlForPdf,
} from "./export-stock-inventory-pdf";
import type { StockListItem } from "../../types/stock";

const sampleItems: StockListItem[] = [
  {
    _id: "1",
    card_id: "sv8-1",
    card_name: "Disponible",
    image_url: "",
    shipment: 0,
    unity_cost: 1,
    cards_in_shipmet: 1,
    card_state: "disponible",
    currency: "EUR",
    card_cost: 1,
  },
  {
    _id: "2",
    card_id: "sv8-2",
    card_name: "Vendida",
    image_url: "",
    shipment: 0,
    unity_cost: 1,
    cards_in_shipmet: 1,
    card_state: "vendida",
    currency: "EUR",
    card_cost: 1,
  },
  {
    _id: "3",
    card_id: "sv8-3",
    card_name: "Colombia",
    image_url: "",
    shipment: 0,
    unity_cost: 1,
    cards_in_shipmet: 1,
    card_state: "en_stock_colombia",
    currency: "EUR",
    card_cost: 1,
  },
];

describe("export-stock-inventory-pdf", () => {
  it("filtra solo inventario disponible", () => {
    const rows = filterAvailableStockForPdf(sampleItems);
    expect(rows.map((r) => r._id).sort()).toEqual(["1", "3"]);
  });

  it("PDF solo incluye cartas con foto de inventario", () => {
    const rows = filterStockWithInventoryPhotosForPdf(sampleItems, {
      "1": "/stock-photos/esteban/sv8-1/1.jpg",
    });
    expect(rows.map((r) => r._id)).toEqual(["1"]);
  });

  it("PDF usa foto de inventario del índice, no image_url del stock", () => {
    const url = resolveInventoryPhotoUrlForPdf(
      {
        _id: "abc",
        card_id: "sv8-194",
        card_name: "Latias",
        image_url: "https://assets.tcgdex.net/en/sv8/194/low.png",
        card_state: "disponible",
      },
      { abc: "/stock-photos/esteban/sv8-194/abc.jpg" },
    );
    expect(url).toContain("/stock-photos/esteban/sv8-194/abc.jpg");
  });

  it("genera nombre de archivo con prefijo del owner", () => {
    expect(
      buildInventoryPdfFilename("pablo", new Date("2026-09-17T12:00:00")),
    ).toBe("inventario-fotos-pablo-20260917.pdf");
    expect(
      buildInventoryPdfFilename("esteban", new Date("2026-09-17T12:00:00")),
    ).toBe("inventario-fotos-esteban-20260917.pdf");
  });

  it("encaja imagen en hueco sin deformar proporción", () => {
    const fit = fitAspectRect(200, 140, 63 / 88);
    expect(fit.w / fit.h).toBeCloseTo(63 / 88, 4);
    expect(fit.w).toBeLessThanOrEqual(200);
    expect(fit.h).toBeLessThanOrEqual(140);
  });

  it("usa grilla compacta de 3 columnas con varias filas por hoja", () => {
    const grid = computeInventoryPdfGridLayout();
    expect(grid.cols).toBe(3);
    expect(grid.rowsPerPage).toBeGreaterThanOrEqual(3);
    expect(grid.cardsPerPage).toBe(grid.cols * grid.rowsPerPage);
  });
});
