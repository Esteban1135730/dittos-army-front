import { describe, expect, it } from "vitest";
import type { SentHomologUnit } from "../../utils/sent-unit-homolog";
import {
  groupSentHomologUnitsByBlueprint,
  pickFocusSentUnit,
} from "./group-sent-units-by-blueprint";

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

describe("groupSentHomologUnitsByBlueprint", () => {
  it("agrupa varias unidades del mismo blueprint", () => {
    const groups = groupSentHomologUnitsByBlueprint([
      unit({ sent_unit_key: "a#1", blueprint_id: 10 }),
      unit({ sent_unit_key: "a#2", blueprint_id: 10 }),
      unit({ sent_unit_key: "b#1", blueprint_id: 20, name: "Mew" }),
    ]);
    expect(groups).toHaveLength(2);
    const pika = groups.find((g) => g.blueprintId === 10);
    expect(pika?.units).toHaveLength(2);
  });

  it("ordena por nombre", () => {
    const groups = groupSentHomologUnitsByBlueprint([
      unit({ sent_unit_key: "1", blueprint_id: 1, name: "Zebra" }),
      unit({ sent_unit_key: "2", blueprint_id: 2, name: "Abra" }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Abra", "Zebra"]);
  });
});

describe("pickFocusSentUnit", () => {
  it("prefiere pendiente con match perfecto", () => {
    const units = [
      unit({ sent_unit_key: "1", status: "verified" }),
      unit({ sent_unit_key: "2", status: "pending" }),
      unit({ sent_unit_key: "3", status: "pending" }),
    ];
    const focus = pickFocusSentUnit(units, (k) => k === "3");
    expect(focus?.sent_unit_key).toBe("3");
  });
});
