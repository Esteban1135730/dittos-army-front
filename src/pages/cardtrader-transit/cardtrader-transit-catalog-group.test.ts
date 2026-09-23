import { describe, expect, it } from "vitest";
import type { CardtraderTransitCatalogLine } from "./cardtrader-transit-types";
import {
  filterTransitCatalogGroups,
  groupTransitCatalogByCard,
  totalCostCop,
  totalRemainingQty,
} from "./cardtrader-transit-catalog-group";

function line(
  partial: Partial<CardtraderTransitCatalogLine> &
    Pick<CardtraderTransitCatalogLine, "transit_line_id" | "card_id" | "card_name">,
): CardtraderTransitCatalogLine {
  return {
    transit_lot_id: "lot-1",
    image_url: "",
    language: "en",
    rareza: null,
    remaining_quantity: 1,
    unit_cost_cop: 1000,
    purchase_date: "2026-09-01",
    created_at: "2026-09-01",
    expansion: null,
    collector_number: null,
    owner: "pablo",
    ...partial,
  };
}

describe("groupTransitCatalogByCard", () => {
  it("agrupa por card_id + language y pondera el costo", () => {
    const groups = groupTransitCatalogByCard([
      line({
        transit_line_id: "a",
        transit_lot_id: "lot-1",
        card_id: "sv01-001",
        card_name: "Pikachu",
        remaining_quantity: 2,
        unit_cost_cop: 1000,
        language: "en",
        expansion: "SV01",
        collector_number: "001",
      }),
      line({
        transit_line_id: "b",
        transit_lot_id: "lot-2",
        card_id: "sv01-001",
        card_name: "Pikachu",
        remaining_quantity: 1,
        unit_cost_cop: 4000,
        language: "en",
      }),
      line({
        transit_line_id: "c",
        card_id: "sv01-001",
        card_name: "Pikachu JP",
        remaining_quantity: 1,
        unit_cost_cop: 500,
        language: "jp",
      }),
      line({
        transit_line_id: "d",
        card_id: "sv01-002",
        card_name: "Already arrived",
        remaining_quantity: 0,
        unit_cost_cop: 999,
      }),
    ]);

    expect(groups).toHaveLength(2);
    const en = groups.find((g) => g.language === "en")!;
    expect(en.remaining_quantity).toBe(3);
    expect(en.total_cost_cop).toBe(6000);
    expect(en.unit_cost_cop).toBe(2000);
    expect(en.lots).toHaveLength(2);
    expect(en.expansion).toBe("SV01");

    const jp = groups.find((g) => g.language === "jp")!;
    expect(jp.remaining_quantity).toBe(1);
  });
});

describe("filterTransitCatalogGroups", () => {
  const groups = groupTransitCatalogByCard([
    line({
      transit_line_id: "1",
      card_id: "a-1",
      card_name: "Charizard",
      expansion: "Base Set",
      collector_number: "4",
      language: "en",
      rareza: "holo",
    }),
    line({
      transit_line_id: "2",
      card_id: "b-2",
      card_name: "Blastoise",
      language: "jp",
      rareza: null,
    }),
  ]);

  it("filtra por texto en nombre/set/#", () => {
    expect(filterTransitCatalogGroups(groups, { text: "base", language: "", rareza: "" })).toHaveLength(
      1,
    );
    expect(filterTransitCatalogGroups(groups, { text: "#4", language: "", rareza: "" }).length).toBe(0);
    expect(
      filterTransitCatalogGroups(groups, { text: "4", language: "", rareza: "" }).map((g) => g.card_name),
    ).toEqual(["Charizard"]);
  });

  it("filtra por idioma y rareza", () => {
    expect(
      filterTransitCatalogGroups(groups, { text: "", language: "jp", rareza: "" }),
    ).toHaveLength(1);
    expect(
      filterTransitCatalogGroups(groups, { text: "", language: "", rareza: "holo" }),
    ).toHaveLength(1);
  });
});

describe("totales", () => {
  it("suma qty y costo", () => {
    const groups = groupTransitCatalogByCard([
      line({
        transit_line_id: "1",
        card_id: "x",
        card_name: "A",
        remaining_quantity: 2,
        unit_cost_cop: 100,
      }),
      line({
        transit_line_id: "2",
        card_id: "y",
        card_name: "B",
        remaining_quantity: 3,
        unit_cost_cop: 200,
      }),
    ]);
    expect(totalRemainingQty(groups)).toBe(5);
    expect(totalCostCop(groups)).toBe(800);
  });
});
