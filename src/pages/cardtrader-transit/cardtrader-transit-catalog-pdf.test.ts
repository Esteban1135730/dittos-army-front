import { describe, expect, it } from "vitest";
import {
  buildTransitCatalogDetailText,
  buildTransitCatalogPdfFilename,
  buildTransitCatalogPdfTableRows,
  transitGroupToPdfLine,
  type TransitCatalogPdfLine,
} from "./cardtrader-transit-catalog-pdf";
import type { TransitCatalogCardGroup } from "./cardtrader-transit-catalog-group";

describe("buildTransitCatalogDetailText", () => {
  it("arma detalle con set e idioma", () => {
    const text = buildTransitCatalogDetailText({
      name: "Pikachu",
      qty: 2,
      unitCostCop: 1000,
      lineCostCop: 2000,
      meta: { expansion: "SV01", collectorNumber: "25", language: "en", rarity: "rare" },
    });
    expect(text).toContain("Pikachu");
    expect(text).toContain("SV01");
    expect(text).toContain("#25");
    expect(text).toContain("EN");
  });
});

describe("buildTransitCatalogPdfTableRows", () => {
  it("agrupa por expansión", () => {
    const lines: TransitCatalogPdfLine[] = [
      {
        name: "B",
        qty: 1,
        unitCostCop: 1,
        lineCostCop: 1,
        meta: { expansion: "Set B" },
      },
      {
        name: "A",
        qty: 1,
        unitCostCop: 1,
        lineCostCop: 1,
        meta: { expansion: "Set A" },
      },
    ];
    const rows = buildTransitCatalogPdfTableRows(lines);
    expect(rows[0]).toEqual({ kind: "group", label: "Set A · 1 carta" });
    expect(rows[1].kind).toBe("line");
  });
});

describe("transitGroupToPdfLine", () => {
  it("mapea grupo a línea PDF", () => {
    const group: TransitCatalogCardGroup = {
      key: "id::en",
      card_id: "id",
      language: "en",
      card_name: "Mew",
      image_url: "https://x",
      expansion: "SV",
      collector_number: "1",
      rareza: null,
      remaining_quantity: 3,
      unit_cost_cop: 500,
      total_cost_cop: 1500,
      lots: [],
    };
    expect(transitGroupToPdfLine(group)).toMatchObject({
      name: "Mew",
      qty: 3,
      unitCostCop: 500,
      lineCostCop: 1500,
    });
  });
});

describe("buildTransitCatalogPdfFilename", () => {
  it("incluye fecha", () => {
    expect(buildTransitCatalogPdfFilename(new Date("2026-09-23T12:00:00Z"))).toBe(
      "transito-cartas-20260923.pdf",
    );
  });
});
