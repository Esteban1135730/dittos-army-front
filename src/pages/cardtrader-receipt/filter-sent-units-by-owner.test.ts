import { describe, expect, it } from "vitest";
import type { PanelHomologItem, SentHomologUnit } from "../../utils/sent-unit-homolog";
import { filterSentUnitsByOwner } from "./filter-sent-units-by-owner";

function panel(
  partial: Partial<PanelHomologItem> & Pick<PanelHomologItem, "transit_line_id">,
): PanelHomologItem {
  return {
    transit_lot_id: "lot-pablo",
    card_id: "sv1-1",
    card_name: "Pikachu",
    image_url: "",
    language: "EN",
    rareza: null,
    remaining_quantity: 1,
    quantity_ordered: 1,
    fx_unit_price: 1,
    fx_total_lot: 1,
    unit_cost_cop: 5000,
    assigned_in_session: 0,
    available_in_session: 1,
    owner: "pablo",
    lot_purchase_date: null,
    lot_total_fx_cards_cost: null,
    lot_total_cop_cards_cost: null,
    real_fx_rate_cop: null,
    ...partial,
  };
}

function unit(
  partial: Partial<SentHomologUnit> & { sent_unit_key: string },
): SentHomologUnit {
  return {
    line_key: "l",
    unit_index: 0,
    order_id: 1,
    order_code: "ORD",
    name: "Pikachu",
    expansion: "SV1",
    language: "EN",
    blueprint_id: 42,
    unit_price_eur: 1,
    unit_price_fx: 1,
    paid_at: null,
    rareza: null,
    status: "pending",
    batch_item_id: null,
    batch_id: null,
    batch_item_card_id: null,
    batch_item_card_name: null,
    transit_line_id: null,
    transit_lot_id: null,
    transit_line_card_id: null,
    transit_line_card_name: null,
    unit_cost_cop: null,
    purchase_price_eur: null,
    purchase_price_fx: null,
    purchase_price_currency: null,
    match_score: null,
    novedad_notes: "",
    ...partial,
  };
}

describe("filterSentUnitsByOwner", () => {
  it("incluye unidades ya homologadas al lote de Esteban", () => {
    const rows = filterSentUnitsByOwner(
      [
        unit({
          sent_unit_key: "e1",
          status: "verified",
          transit_line_id: "tl-e",
          transit_lot_id: "lot-e",
        }),
        unit({
          sent_unit_key: "p1",
          status: "verified",
          transit_line_id: "tl-p",
          transit_lot_id: "lot-p",
        }),
      ],
      [
        panel({
          transit_line_id: "tl-e",
          transit_lot_id: "lot-e",
          owner: "esteban",
          available_in_session: 0,
        }),
        panel({ transit_line_id: "tl-p", owner: "pablo" }),
      ],
      "esteban",
    );
    expect(rows.map((r) => r.sent_unit_key)).toEqual(["e1"]);
  });

  it("asigna pendientes al cupo de Esteban por blueprint y no se pasa", () => {
    const rows = filterSentUnitsByOwner(
      [
        unit({ sent_unit_key: "a", blueprint_id: 10 }),
        unit({ sent_unit_key: "b", blueprint_id: 10 }),
        unit({ sent_unit_key: "c", blueprint_id: 10 }),
      ],
      [
        panel({
          transit_line_id: "tl-e",
          transit_lot_id: "lot-e",
          owner: "esteban",
          blueprint_id: 10,
          remaining_quantity: 2,
          available_in_session: 2,
        }),
        panel({
          transit_line_id: "tl-p",
          owner: "pablo",
          blueprint_id: 10,
          remaining_quantity: 1,
          available_in_session: 1,
        }),
      ],
      "esteban",
    );
    expect(rows.map((r) => r.sent_unit_key)).toEqual(["a", "b"]);
  });

  it("sin owner en panel trata el lote como Pablo", () => {
    const rows = filterSentUnitsByOwner(
      [unit({ sent_unit_key: "x", blueprint_id: 7 })],
      [
        panel({
          transit_line_id: "tl",
          owner: undefined,
          blueprint_id: 7,
        }),
      ],
      "esteban",
    );
    expect(rows).toHaveLength(0);
  });
});
